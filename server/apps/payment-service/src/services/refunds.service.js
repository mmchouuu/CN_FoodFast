const { pool } = require('../models/payment.model');
const paymentModel = require('../models/payment.model');
const stripeService = require('./stripe.service');
const { publishEvent } = require('../publishers/outbox.publisher');

const insertRefund = async (client, payload) => {
  const {
    paymentId,
    orderId,
    amount,
    status,
    idempotencyKey = null,
    flow = 'online',
    method = null,
    userBankAccountId = null,
  } = payload;

  const res = await client.query(
    `
      INSERT INTO refunds (
        payment_id,
        order_id,
        amount,
        status,
        idempotency_key,
        flow,
        method,
        user_bank_account_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      paymentId,
      orderId,
      amount,
      status,
      idempotencyKey,
      flow,
      method,
      userBankAccountId,
    ],
  );

  return res.rows[0];
};

async function processRefund({
  paymentId,
  amount,
  reason,
  idempotencyKey = null,
}) {
  if (!paymentId || !amount) {
    throw Object.assign(new Error('paymentId and amount are required'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await paymentModel.getPayment(paymentId);
    if (!payment) {
      throw Object.assign(new Error('payment not found'), { statusCode: 404 });
    }

    const existing =
      idempotencyKey && (await client.query('SELECT * FROM refunds WHERE idempotency_key = $1', [idempotencyKey]))
        .rows[0];
    if (existing) {
      await client.query('ROLLBACK');
      return existing;
    }

    const flow = payment.flow || 'online';
    let status = 'pending';

    if (flow === 'online' && payment.transaction_id) {
      try {
        await stripeService.refundPaymentIntent({
          paymentIntentId: payment.transaction_id,
          amount,
          currency: payment.currency,
          reason,
        });
        status = 'succeeded';
      } catch (error) {
        console.error('[payment-service] Stripe refund failed:', error);
        status = 'failed';
      }
    } else {
      status = 'succeeded';
    }

    const refund = await insertRefund(client, {
      paymentId,
      orderId: payment.order_id,
      amount,
      status,
      idempotencyKey,
      flow,
      method: flow === 'online' ? 'to_source' : 'cash',
    });

    if (status === 'succeeded') {
      await paymentModel.updatePayment(paymentId, { status: 'refunded' }, client);
    }

    await paymentModel.insertPaymentLog(
      {
        paymentId,
        action: 'RefundProcessed',
        data: { refund_id: refund.id, status, amount },
      },
      client,
    );

    await client.query('COMMIT');

    if (status === 'succeeded') {
      await publishEvent('RefundCompleted', {
        order_id: payment.order_id,
        payment_id: paymentId,
        refund_id: refund.id,
        amount,
      });
    } else {
      await publishEvent('RefundFailed', {
        order_id: payment.order_id,
        payment_id: paymentId,
        refund_id: refund.id,
        amount,
        reason: 'stripe_refund_failed',
      });
    }

    return refund;
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
