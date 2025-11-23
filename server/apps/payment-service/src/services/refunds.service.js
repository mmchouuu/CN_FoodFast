const { pool } = require('../models/payment.model');
const paymentModel = require('../models/payment.model');
const stripeService = require('./stripe.service');
const { publishEvent } = require('../publishers/outbox.publisher');
const settlementsService = require('./settlements.service');

const toAmount = (value, fractionDigits = 2) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(fractionDigits));
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

const recordOrderRefundLink = async (client, { orderId, paymentId, amount }) => {
  if (!client || !orderId || !paymentId) {
    return;
  }
  const resolvedAmount = -Math.abs(toAmount(amount));
  await client.query(
    `
      INSERT INTO order_payments (order_id, payment_id, amount, role)
      VALUES ($1,$2,$3,'refund')
      ON CONFLICT (order_id, payment_id)
      DO UPDATE SET amount = EXCLUDED.amount,
                    role = EXCLUDED.role
    `,
    [orderId, paymentId, resolvedAmount],
  );
};

const insertPlatformRefundTransaction = async (
  client,
  { bankAccountId, payment, refund, amount, currency, source },
) => {
  if (!client || !bankAccountId || !payment?.id || !refund?.id || !amount) {
    return;
  }
  const existing = await client.query(
    `
      SELECT id
      FROM platform_transactions
      WHERE refund_id = $1
        AND txn_type = 'outflow_refund'
      LIMIT 1
    `,
    [refund.id],
  );
  if (existing.rows.length) {
    return;
  }
  const description = `Refund for order ${payment.order_id || 'N/A'} via ${source || 'online'}`;
  await client.query(
    `
      INSERT INTO platform_transactions (
        payment_id,
        refund_id,
        platform_bank_account_id,
        txn_type,
        source,
        description,
        amount,
        currency,
        status,
        occurred_at,
        created_at
      )
      VALUES ($1,$2,$3,'outflow_refund',$4,$5,$6,$7,'completed',now(),now())
    `,
    [payment.id, refund.id, bankAccountId, source || payment.flow || 'online', description, amount, currency],
  );
};

const adjustPlatformLedgerBalance = async (client, { bankAccountId, amountDelta, currency }) => {
  if (!client || !bankAccountId || !amountDelta) return;
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
    [bankAccountId, amountDelta, currency],
  );
};

const insertRefund = async (client, payload) => {
  const {
    paymentId,
    orderId,
    userId,
    amount,
    reason,
    status,
    method = 'to_source',
    destinationPaymentMethodId = null,
  } = payload;

  const res = await client.query(
    `
      INSERT INTO refunds (
        payment_id,
        order_id,
        user_id,
        amount,
        reason,
        status,
        method,
        destination_payment_method_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      paymentId,
      orderId,
      userId,
      amount,
      reason,
      status,
      method,
      destinationPaymentMethodId,
    ],
  );

  return res.rows[0];
};

async function processRefund({
  paymentId,
  orderId,
  amount,
  reason,
}) {
  if ((!paymentId && !orderId) || amount === undefined || amount === null) {
    throw Object.assign(new Error('paymentId or orderId and amount are required'), {
      statusCode: 400,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let payment = null;
    if (paymentId) {
      payment = await paymentModel.getPayment(paymentId);
    } else if (orderId) {
      const latest = await paymentModel.findLatestPaymentsByOrderIds([orderId]);
      payment = Array.isArray(latest) && latest.length ? latest[0] : null;
      if (payment) {
        paymentId = payment.id;
      }
    }

    if (!payment) {
      throw Object.assign(new Error('payment not found'), { statusCode: 404 });
    }

    const refundAmount = toAmount(
      amount !== undefined && amount !== null ? amount : payment.amount,
    );
    if (!refundAmount) {
      throw Object.assign(new Error('refund amount must be greater than 0'), {
        statusCode: 400,
      });
    }
    const refundReason = reason || 'order_cancelled';
    const destinationPaymentMethodId = payment.payment_method_id || null;
    const currencyCode = normalizeCurrency(payment.currency || 'VND');

    const refund = await insertRefund(client, {
      paymentId,
      orderId: payment.order_id,
      userId: payment.user_id,
      amount: refundAmount,
      reason: refundReason,
      status: 'pending',
      method: 'to_source',
      destinationPaymentMethodId,
    });

    await paymentModel.insertPaymentLog(
      {
        paymentId,
        action: 'refund_created',
        data: {
          refund_id: refund.id,
          amount: refundAmount,
          reason: refundReason,
          provider: payment.flow || 'online',
          transaction_id: payment.transaction_id,
        },
      },
      client,
    );

    const flow = payment.flow || 'online';
    let status = 'pending';
    let providerResponse = null;
    let providerError = null;
    let processedAt = null;

    if (flow === 'online' && payment.transaction_id) {
      try {
        providerResponse = await stripeService.refundPaymentIntent({
          paymentIntentId: payment.transaction_id,
          amount: refundAmount,
          currency: payment.currency,
          reason: refundReason,
        });
        status = 'succeeded';
        processedAt = new Date();
      } catch (error) {
        console.error('[payment-service] Stripe refund failed:', error);
        providerError = {
          message: error?.message || 'refund failed',
          code: error?.code || error?.statusCode || null,
        };
        status = 'failed';
      }
    } else {
      status = 'succeeded';
      processedAt = new Date();
    }

    const updatedRefundRes = await client.query(
      `
        UPDATE refunds
           SET status = $2,
               processed_at = $3
         WHERE id = $1
         RETURNING *
      `,
      [refund.id, status, processedAt],
    );
    const updatedRefund = updatedRefundRes.rows[0] || refund;

    await paymentModel.insertPaymentLog(
      {
        paymentId,
        action: status === 'succeeded' ? 'refund_succeeded' : 'refund_failed',
        data: {
          refund_id: updatedRefund.id,
          amount: refundAmount,
          provider_response: providerResponse || null,
          error: providerError || null,
        },
      },
      client,
    );

    if (status === 'succeeded') {
      await paymentModel.updatePayment(paymentId, { status: 'refunded' }, client);
      await recordOrderRefundLink(client, {
        orderId: payment.order_id,
        paymentId,
        amount: refundAmount,
      });
      const bankAccountId = await selectPrimaryPlatformBankAccountId(client);
      if (bankAccountId) {
        await insertPlatformRefundTransaction(client, {
          bankAccountId,
          payment,
          refund: updatedRefund,
          amount: refundAmount,
          currency: currencyCode,
          source: payment.flow || 'online',
        });
        await adjustPlatformLedgerBalance(client, {
          bankAccountId,
          amountDelta: -refundAmount,
          currency: currencyCode,
        });
      }
    }

    await client.query('COMMIT');

    if (status === 'succeeded') {
      await publishEvent('RefundCompleted', {
        order_id: payment.order_id,
        payment_id: paymentId,
        refund_id: updatedRefund.id,
        amount: refundAmount,
        processed_at: processedAt ? new Date(processedAt).toISOString() : null,
      });
      await settlementsService.recordRefund(updatedRefund, payment, {
        reason: refundReason,
        actor: 'system',
        auto: true,
      });
    } else {
      await publishEvent('RefundFailed', {
        order_id: payment.order_id,
        payment_id: paymentId,
        refund_id: updatedRefund.id,
        amount: refundAmount,
        reason: providerError?.message || 'refund_failed',
      });
    }

    return updatedRefund;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listRefunds(filters) {
  return paymentModel.listRefunds(filters);
}

module.exports = {
  processRefund,
  listRefunds,
};

