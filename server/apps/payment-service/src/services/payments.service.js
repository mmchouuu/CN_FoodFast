const { pool } = require('../models/payment.model');
const paymentModel = require('../models/payment.model');
const paymentMethodModel = require('../models/paymentMethod.model');
const stripeService = require('./stripe.service');
const { publishEvent } = require('../publishers/outbox.publisher');

const normalizeNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const selectDefaultStripeMethod = async (userId) => {
  const methods = await paymentMethodModel.listStripePaymentMethods(userId);
  if (!methods.length) {
    return null;
  }
  const preferred = methods.find((method) => method.is_default);
  return preferred || methods[0];
};

async function handlePaymentPending(event) {
  const {
    order_id: orderId,
    user_id: userId,
    restaurant_id: restaurantId,
    branch_id: branchId,
    amount,
    currency = 'VND',
    flow = 'online',
    method,
    idempotency_key: idempotencyKey = null,
    metadata = {},
  } = event || {};

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

    const payment = await paymentModel.createPayment(
      {
        order_id: orderId,
        user_id: userId,
        restaurant_id: restaurantId,
        branch_id: branchId,
        amount,
        currency,
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
      });
      return updated;
    }

    // flow === 'online'
    const stripeMethod = await selectDefaultStripeMethod(userId);
    if (!stripeMethod || !stripeMethod.provider_data?.customer_id) {
      await paymentModel.updatePayment(
        payment.id,
        { status: 'failed' },
        client,
      );
      await client.query('COMMIT');
      await publishEvent('PaymentFailed', {
        order_id: orderId,
        payment_id: payment.id,
        reason: 'no_payment_method',
      });
      return null;
    }

    try {
      const paymentIntent = await stripeService.createPaymentIntent({
        customerId: stripeMethod.provider_data.customer_id,
        paymentMethodId: stripeMethod.provider_data.payment_method_id,
        amount,
        currency,
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
          currency,
        });
      } else {
        await publishEvent('PaymentPending', {
          order_id: orderId,
          payment_id: payment.id,
          status: paymentIntent.status,
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

module.exports = {
  handlePaymentPending,
  listPayments,
};
