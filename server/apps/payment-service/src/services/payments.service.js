const { pool } = require('../models/payment.model');
const paymentModel = require('../models/payment.model');
const paymentMethodModel = require('../models/paymentMethod.model');
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

      await client.query('COMMIT');

      if (paymentIntent.status === 'succeeded') {
        await publishEvent('PaymentSucceeded', {
          order_id: orderId,
          payment_id: payment.id,
          transaction_id: paymentIntent.id,
          amount,
          currency: currencyCode,
        });
      } else {
        await publishEvent('PaymentPending', {
          order_id: orderId,
          payment_id: payment.id,
          status: paymentIntent.status,
          currency: currencyCode,
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
  const payment = await paymentModel.updatePayment(paymentId, {
    status: 'succeeded',
    transaction_id: transactionId || undefined,
    paid_at: new Date(),
  });
  await paymentModel.insertPaymentLog(
    {
      paymentId,
      action: 'PaymentSucceeded',
      data: { provider, transactionId, metadata },
    },
    null,
  );

  await publishEvent('PaymentSucceeded', {
    order_id: payment.order_id,
    payment_id: payment.id,
    transaction_id: payment.transaction_id,
    amount: amount || payment.amount,
    currency: currency || payment.currency,
    provider,
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
