const { pool } = require('../models/payment.model');
const paymentModel = require('../models/payment.model');
const paymentMethodModel = require('../models/paymentMethod.model');
const orderStatusModel = require('../models/orderStatus.model');
const stripeService = require('./stripe.service');
const { publishEvent } = require('../publishers/outbox.publisher');
const { fetchOrderById } = require('../clients/order.client');

const normalizeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const selectDefaultStripeMethod = async (userId, preferredMethodId = null) => {
  if (preferredMethodId) {
    let preferredRecord = await paymentMethodModel.findPaymentMethodById(
      preferredMethodId,
      userId,
    );
    if (
      (!preferredRecord ||
        preferredRecord.type !== 'card' ||
        preferredRecord.provider !== 'stripe' ||
        !preferredRecord.provider_data?.payment_method_id) &&
      typeof preferredMethodId === 'string' &&
      preferredMethodId.startsWith('pm_')
    ) {
      preferredRecord = await paymentMethodModel.findPaymentMethodByProviderPaymentId(
        preferredMethodId,
        userId,
      );
    }
    if (
      preferredRecord &&
      preferredRecord.type === 'card' &&
      preferredRecord.provider === 'stripe' &&
      preferredRecord.provider_data?.payment_method_id
    ) {
      return preferredRecord;
    }
  }

  const methods = await paymentMethodModel.listStripePaymentMethods(userId);
  if (!methods.length) {
    return null;
  }
  const preferred = methods.find((method) => method.is_default);
  return preferred || methods[0];
};

const normalizeCurrency = (value) => {
  if (typeof value !== 'string') {
    return 'VND';
  }
  const trimmed = value.trim();
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return 'VND';
};

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const extractRestaurantContext = (order = {}) => {
  const metadata = parseJson(order.metadata) || {};
  const restaurantId =
    order.restaurant_id ||
    order.restaurantId ||
    metadata.restaurant_id ||
    metadata.restaurantId ||
    metadata.restaurant_snapshot?.id ||
    metadata.restaurant?.id ||
    null;
  const branchId =
    order.branch_id ||
    order.branchId ||
    metadata.branch_id ||
    metadata.branchId ||
    metadata.branch_snapshot?.id ||
    (Array.isArray(metadata.branch_ids) && metadata.branch_ids.length === 1
      ? metadata.branch_ids[0]
      : null);
  return {
    restaurantId: restaurantId || null,
    branchId: branchId || null,
  };
};

const toAmount = (value, fractionDigits = 2) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(fractionDigits));
};

const safeFetchOrder = async (orderId) => {
  if (!orderId) return null;
  try {
    return await fetchOrderById(orderId);
  } catch (error) {
    console.warn(
      '[payment-service] Unable to fetch order for payment side-effects:',
      error?.message || error,
    );
    return null;
  }
};

const linkPaymentToOrder = async (client, payment, amount) => {
  if (!client || !payment?.order_id || !payment?.id) {
    return;
  }
  const resolvedAmount = toAmount(
    amount !== undefined && amount !== null ? amount : payment.amount,
  );
  await client.query(
    `
      INSERT INTO order_payments (order_id, payment_id, amount, role)
      VALUES ($1,$2,$3,'charge')
      ON CONFLICT (order_id, payment_id)
      DO UPDATE SET amount = EXCLUDED.amount,
                    role = EXCLUDED.role
    `,
    [payment.order_id, payment.id, resolvedAmount],
  );
};

const persistTaxComponents = async (client, paymentId, currencyCode, orderSnapshot) => {
  if (!client || !paymentId || !orderSnapshot) return;
  const breakdowns = Array.isArray(orderSnapshot.tax_breakdowns)
    ? orderSnapshot.tax_breakdowns
    : Array.isArray(orderSnapshot.taxBreakdowns)
    ? orderSnapshot.taxBreakdowns
    : [];

  const components = breakdowns
    .map((tax) => {
      const amount =
        toAmount(
          tax.tax_amount ??
            tax.taxAmount ??
            tax.amount ??
            tax.value ??
            null,
        );
      return amount > 0
        ? {
            amount,
            metadata: {
              tax_template_code:
                tax.tax_template_code ??
                tax.taxTemplateCode ??
                tax.code ??
                null,
              tax_rate: tax.tax_rate ?? tax.taxRate ?? null,
            },
          }
        : null;
    })
    .filter(Boolean);

  if (!components.length) {
    const taxTotal = toAmount(
      orderSnapshot.tax_total ??
        orderSnapshot.taxTotal ??
        null,
    );
    if (taxTotal > 0) {
      components.push({
        amount: taxTotal,
        metadata: { source: 'order.tax_total' },
      });
    }
  }

  if (!components.length) {
    return;
  }

  await client.query(
    `
      DELETE FROM payment_fee_components
      WHERE payment_id = $1
        AND component_type = 'tax_withheld'
    `,
    [paymentId],
  );

  for (const component of components) {
    await client.query(
      `
        INSERT INTO payment_fee_components (
          payment_id,
          component_type,
          amount,
          currency,
          metadata
        )
        VALUES ($1,'tax_withheld',$2,$3,$4)
      `,
      [paymentId, component.amount, currencyCode, component.metadata || null],
    );
  }
};

const selectPrimaryPlatformBankAccountId = async (client) => {
  if (!client) return null;
  const result = await client.query(
    `
      SELECT id
      FROM platform_bank_accounts
      WHERE is_primary = TRUE
        AND is_active = TRUE
      ORDER BY updated_at DESC
      LIMIT 1
    `,
  );
  return result.rows[0]?.id || null;
};

const ensurePlatformTransactionRecord = async (
  client,
  { payment, bankAccountId, provider, amount, currencyCode, orderSnapshot },
) => {
  if (!client || !payment?.id || !bankAccountId || !amount) return;

  const existing = await client.query(
    `
      SELECT id
      FROM platform_transactions
      WHERE payment_id = $1
        AND txn_type = 'inflow_payment'
      LIMIT 1
    `,
    [payment.id],
  );
  if (existing.rows.length) {
    return;
  }

  const sourceLabel = provider || payment.flow || 'online';
  const orderLabel =
    orderSnapshot?.code ||
    orderSnapshot?.order_code ||
    orderSnapshot?.orderCode ||
    orderSnapshot?.reference_code ||
    payment.order_id;
  const description = `Customer paid order ${orderLabel} via ${sourceLabel}`;

  await client.query(
    `
      INSERT INTO platform_transactions (
        payment_id,
        platform_bank_account_id,
        txn_type,
        source,
        description,
        amount,
        currency,
        status
      )
      VALUES ($1,$2,'inflow_payment',$3,$4,$5,$6,'completed')
    `,
    [payment.id, bankAccountId, sourceLabel, description, amount, currencyCode],
  );
};

const incrementPlatformLedgerBalance = async (
  client,
  { bankAccountId, amount, currencyCode },
) => {
  if (!client || !bankAccountId || !amount) return;
  await client.query(
    `
      INSERT INTO platform_ledger_balances (
        platform_bank_account_id,
        current_balance,
        currency,
        last_updated_at
      )
      VALUES ($1,$2,$3,now())
      ON CONFLICT (platform_bank_account_id)
      DO UPDATE SET
        current_balance = platform_ledger_balances.current_balance + EXCLUDED.current_balance,
        currency = EXCLUDED.currency,
        last_updated_at = now()
    `,
    [bankAccountId, amount, currencyCode],
  );
};

const syncPaymentSuccessArtifacts = async ({
  client,
  payment,
  provider,
  amountOverride,
  currencyOverride,
  orderSnapshot = null,
}) => {
  if (!client || !payment) return;

  const resolvedAmount = toAmount(amountOverride ?? payment.amount);
  const currencyCode = normalizeCurrency(currencyOverride || payment.currency || 'VND');

  await linkPaymentToOrder(client, payment, resolvedAmount);

  if (payment.flow !== 'online') {
    return;
  }

  const orderData = orderSnapshot || (await safeFetchOrder(payment.order_id));
  if (orderData) {
    await persistTaxComponents(client, payment.id, currencyCode, orderData);
  }

  if (!(resolvedAmount > 0)) {
    return;
  }

  const bankAccountId = await selectPrimaryPlatformBankAccountId(client);
  if (!bankAccountId) {
    console.warn(
      '[payment-service] Missing primary platform bank account, skip ledger update for payment',
      payment.id,
    );
    return;
  }

  await ensurePlatformTransactionRecord(client, {
    payment,
    bankAccountId,
    provider,
    amount: resolvedAmount,
    currencyCode,
    orderSnapshot: orderData,
  });

  await incrementPlatformLedgerBalance(client, {
    bankAccountId,
    amount: resolvedAmount,
    currencyCode,
  });

  try {
    await orderStatusModel.markOrderPaymentPaid(payment.order_id);
  } catch (error) {
    console.error(
      '[payment-service] Failed to update order payment_status for',
      payment.order_id,
      error?.message || error,
    );
  }
};


async function handlePaymentPending(event) {
  const {
    order_id: orderId,
    user_id: userId,
    restaurant_id: restaurantIdRaw = null,
    restaurantId: restaurantIdCamel = null,
    branch_id: branchIdRaw = null,
    branchId: branchIdCamel = null,
    amount,
    currency = 'VND',
    flow = 'online',
    method,
    payment_method_id: requestedPaymentMethodId = null,
    idempotency_key: idempotencyKey = null,
    metadata = {},
  } = event || {};
  let restaurantId = restaurantIdRaw || restaurantIdCamel || null;
  let branchId = branchIdRaw || branchIdCamel || null;
  const currencyCode = normalizeCurrency(currency);

  if (!orderId || !userId || !normalizeNumber(amount)) {
    console.error('[payment-service] invalid PaymentPending payload', event);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let existing = null;
    if (idempotencyKey) {
      existing = await paymentModel.findPaymentByIdempotencyKey(idempotencyKey, userId);
    }
    if (existing) {
      await client.query('ROLLBACK');
      return existing;
    }

    let stripeMethod = null;
    let cachedOrder = null;
    let attemptedOrderFetch = false;

    const ensureOrderContext = async () => {
      if (attemptedOrderFetch) return cachedOrder;
      attemptedOrderFetch = true;
      try {
        cachedOrder = await fetchOrderById(orderId);
      } catch (orderErr) {
        console.error(
          '[payment-service] Failed to fetch order for payment context:',
          orderErr?.message || orderErr,
        );
        cachedOrder = null;
      }
      return cachedOrder;
    };

    if (!restaurantId || !branchId) {
      const orderData = await ensureOrderContext();
      if (orderData) {
        const context = extractRestaurantContext(orderData);
        if (!restaurantId) restaurantId = context.restaurantId;
        if (!branchId) branchId = context.branchId;
      } else if (!restaurantId) {
        console.warn(
          '[payment-service] Missing restaurant_id and unable to load order context for',
          orderId,
        );
      }
    }

    if (!restaurantId) {
      await client.query('ROLLBACK');
      const error = new Error('restaurant_id is required to create payment');
      error.status = 400;
      throw error;
    }

    if (flow === 'online') {
      stripeMethod = await selectDefaultStripeMethod(userId, requestedPaymentMethodId);
      if (!stripeMethod || !stripeMethod.provider_data?.customer_id) {
        await client.query('ROLLBACK');
        await publishEvent('PaymentFailed', {
          order_id: orderId,
          payment_id: null,
          reason: 'no_payment_method',
          flow,
        });
        return null;
      }
    }

    const payment = await paymentModel.createPayment(
      {
        order_id: orderId,
        user_id: userId,
        restaurant_id: restaurantId,
        branch_id: branchId,
        amount,
        currency: currencyCode,
        payment_method_id: stripeMethod?.id || null,

        idempotency_key: idempotencyKey,
        status: flow === 'cash' ? 'succeeded' : 'pending',
        flow,
      },
      client,
    );

    if (flow === 'cash') {
      const updated = await paymentModel.updatePayment(
        payment.id,
        {
          status: 'succeeded',
          paid_at: new Date(),
          transaction_id: `cash_${payment.id}`,
        },
        client,
      );

      await paymentModel.insertPaymentLog(
        {
          paymentId: updated.id,
          action: 'PaymentSucceeded',
          data: { flow, method },
        },
        client,
      );

      await syncPaymentSuccessArtifacts({
        client,
        payment: updated,
        provider: method || flow,
        amountOverride: amount,
        currencyOverride: currencyCode,
        orderSnapshot: cachedOrder,
      });

      await client.query('COMMIT');
      await publishEvent('PaymentSucceeded', {
        order_id: orderId,
        payment_id: updated.id,
        amount,
        flow,
        currency: currencyCode,
      });
      return updated;
    }

    try {
      const paymentIntent = await stripeService.createPaymentIntent({
        customerId: stripeMethod.provider_data.customer_id,
        paymentMethodId: stripeMethod.provider_data.payment_method_id,
        amount,
        currency: currencyCode,
        metadata: {
          orderId,
          userId,
          paymentId: payment.id,
          ...metadata,
        },
        description: `Order ${orderId}`,
      });

      const updated = await paymentModel.updatePayment(
        payment.id,
        {
          status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
          transaction_id: paymentIntent.id,
          payment_method_id: stripeMethod.id,
          paid_at:
            paymentIntent.status === 'succeeded' ? new Date() : payment.paid_at,
        },
        client,
      );

      await paymentModel.insertPaymentLog(
        {
          paymentId: payment.id,
          action: 'StripePaymentIntent',
          data: {
            payment_intent_id: paymentIntent.id,
            status: paymentIntent.status,
          },
        },
        client,
      );

      if (paymentIntent.status === 'succeeded') {
        await syncPaymentSuccessArtifacts({
          client,
          payment: updated,
          provider: method || flow,
          amountOverride: amount,
          currencyOverride: currencyCode,
          orderSnapshot: cachedOrder,
        });
      }

      await client.query('COMMIT');

      if (paymentIntent.status === 'succeeded') {
        await publishEvent('PaymentSucceeded', {
          order_id: orderId,
          payment_id: payment.id,
          transaction_id: paymentIntent.id,
          amount,
          currency: currencyCode,
          flow,
        });
      } else {
        await publishEvent('PaymentPending', {
          order_id: orderId,
          payment_id: payment.id,
          status: paymentIntent.status,
          currency: currencyCode,
          flow,
        });
      }

      return updated;
    } catch (error) {
      await paymentModel.updatePayment(
        payment.id,
        { status: 'failed' },
        client,
      );
      await paymentModel.insertPaymentLog(
        {
          paymentId: payment.id,
          action: 'PaymentFailed',
          data: { error: error.message },
        },
        client,
      );
      await client.query('COMMIT');
      await publishEvent('PaymentFailed', {
        order_id: orderId,
        payment_id: payment.id,
        reason: error.message,
        currency: currencyCode,
        flow,
      });
      console.error('[payment-service] Stripe charge failed:', error);
      return null;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[payment-service] handlePaymentPending error:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function listPayments(filters) {
  return paymentModel.listPayments(filters);
}

async function getPaymentForUser(paymentId, userId) {
  if (!paymentId) {
    throw Object.assign(new Error('payment id is required'), { statusCode: 400 });
  }
  if (!userId) {
    throw Object.assign(new Error('user id is required'), { statusCode: 401 });
  }
  return paymentModel.getPaymentForUser(paymentId, userId);
}

async function getPaymentByTransactionId(transactionId) {
  return paymentModel.findPaymentByTransactionId(transactionId);
}

async function markPaymentSucceeded({
  paymentId,
  transactionId,
  provider,
  amount,
  currency,
  metadata = {},
}) {
  if (!paymentId) {
    throw Object.assign(new Error('payment id is required'), { statusCode: 400 });
  }
  const client = await pool.connect();
  let payment;
  try {
    await client.query('BEGIN');
    payment = await paymentModel.updatePayment(
      paymentId,
      {
        status: 'succeeded',
        transaction_id: transactionId || undefined,
        paid_at: new Date(),
      },
      client,
    );

    await paymentModel.insertPaymentLog(
      {
        paymentId,
        action: 'PaymentSucceeded',
        data: { provider, transactionId, metadata },
      },
      client,
    );

    await syncPaymentSuccessArtifacts({
      client,
      payment,
      provider,
      amountOverride: amount,
      currencyOverride: currency,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await publishEvent('PaymentSucceeded', {
    order_id: payment.order_id,
    payment_id: payment.id,
    transaction_id: payment.transaction_id,
    amount: amount || payment.amount,
    currency: currency || payment.currency,
    provider,
    flow: payment.flow,
  });
  return payment;
}

async function markPaymentFailed({ paymentId, transactionId, provider, reason, metadata = {} }) {
  if (!paymentId) {
    throw Object.assign(new Error('payment id is required'), { statusCode: 400 });
  }
  const payment = await paymentModel.updatePayment(paymentId, {
    status: 'failed',
    transaction_id: transactionId || undefined,
  });
  await paymentModel.insertPaymentLog(
    {
      paymentId,
      action: 'PaymentFailed',
      data: { provider, transactionId, reason, metadata },
    },
    null,
  );
  await publishEvent('PaymentFailed', {
    order_id: payment.order_id,
    payment_id: payment.id,
    transaction_id: payment.transaction_id,
    reason: reason || 'payment_failed',
    provider,
    flow: payment.flow,
  });
  return payment;
}

async function getPaymentsForOrders(orderIds = []) {
  if (!Array.isArray(orderIds) || !orderIds.length) {
    return [];
  }

  const rows = await paymentModel.findLatestPaymentsByOrderIds(orderIds);

  return rows.map((row) => {
    const details = {
      type: row.method_type || null,
      provider: row.method_provider || null,
      brand: row.method_brand || null,
      last4: row.method_last4 || null,
      exp_month: row.method_exp_month || null,
      exp_year: row.method_exp_year || null,
      provider_data: row.method_provider_data || null,
    };

    let displayName = null;
    if (row.flow === 'cash') {
      displayName = 'Cash on Delivery';
    } else if (details.type === 'card') {
      const labelBrand = details.brand || (details.provider ? details.provider.toUpperCase() : 'Card');
      displayName = details.last4
        ? `${labelBrand} •••• ${details.last4}`
        : labelBrand;
    } else if (details.type === 'wallet') {
      const providerLabel = details.provider ? details.provider.toUpperCase() : 'Wallet';
      displayName = details.last4
        ? `${providerLabel} •••• ${details.last4}`
        : providerLabel;
    } else if (row.flow === 'online') {
      displayName = 'Online payment';
    }

    return {
      order_id: row.order_id,
      payment_id: row.id,
      status: row.status,
      flow: row.flow,
      amount: normalizeNumber(row.amount),
      currency: row.currency,
      paid_at: row.paid_at,
      payment_method_id: row.payment_method_id,
      method_details: details,
      display_name: displayName,
    };
  });
}

module.exports = {
  handlePaymentPending,
  listPayments,
  getPaymentForUser,
  getPaymentByTransactionId,
  markPaymentSucceeded,
  markPaymentFailed,
  getPaymentsForOrders,
};
