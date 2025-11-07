const stripeService = require('../services/stripe.service');
const paymentsService = require('../services/payments.service');
const momoService = require('../services/momo.service');

const getRawBody = (req) => {
  if (req.rawBody) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    return Buffer.from(req.body, 'utf8');
  }
  return Buffer.from(JSON.stringify(req.body || {}), 'utf8');
};

async function handleStripeIntentSucceeded(paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  let paymentId = metadata.paymentId;
  if (!paymentId) {
    const payment = await paymentsService.getPaymentByTransactionId(paymentIntent.id);
    paymentId = payment?.id;
  }
  if (!paymentId) {
    return;
  }
  await paymentsService.markPaymentSucceeded({
    paymentId,
    transactionId: paymentIntent.id,
    provider: 'stripe',
    amount:
      typeof paymentIntent.amount_received === 'number'
        ? paymentIntent.amount_received / 100
        : undefined,
    currency: paymentIntent.currency ? paymentIntent.currency.toUpperCase() : undefined,
    metadata,
  });
}

async function handleStripeIntentFailed(paymentIntent) {
  const metadata = paymentIntent.metadata || {};
  let paymentId = metadata.paymentId;
  if (!paymentId) {
    const payment = await paymentsService.getPaymentByTransactionId(paymentIntent.id);
    paymentId = payment?.id;
  }
  if (!paymentId) {
    return;
  }
  await paymentsService.markPaymentFailed({
    paymentId,
    transactionId: paymentIntent.id,
    provider: 'stripe',
    reason: paymentIntent.last_payment_error?.message || 'payment_failed',
    metadata,
  });
}

exports.handleStripeWebhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing stripe signature');
  }
  let event;
  try {
    event = stripeService.constructWebhookEvent(getRawBody(req), signature);
  } catch (error) {
    console.error('[payment-service] stripe webhook signature failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripeIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handleStripeIntentFailed(event.data.object);
        break;
      default:
        break;
    }
    return res.json({ received: true });
  } catch (error) {
    console.error('[payment-service] stripe webhook handler failed:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
};

exports.handleMomoWebhook = async (req, res) => {
  const payload = req.body || {};
  if (!momoService.verifyIpnSignature(payload)) {
    return res.status(400).json({ error: 'invalid momo signature' });
  }
  const extraData = momoService.decodeExtraData(payload.extraData) || {};
  let paymentId = extraData.paymentId;
  if (!paymentId) {
    const payment = await paymentsService.getPaymentByTransactionId(payload.orderId);
    paymentId = payment?.id;
  }
  const resultCode = Number(payload.resultCode);
  try {
    if (paymentId && resultCode === 0) {
      await paymentsService.markPaymentSucceeded({
        paymentId,
        transactionId: payload.transId || payload.orderId,
        provider: 'momo',
        amount: Number(payload.amount) || undefined,
        currency: payload.currency,
        metadata: extraData,
      });
    } else if (paymentId) {
      await paymentsService.markPaymentFailed({
        paymentId,
        transactionId: payload.transId || payload.orderId,
        provider: 'momo',
        reason: payload.message || 'payment_failed',
        metadata: payload,
      });
    }
    return res.json({
      resultCode: 0,
      message: 'success',
    });
  } catch (error) {
    console.error('[payment-service] momo webhook failed:', error);
    return res.status(500).json({ error: 'Failed to process MoMo webhook' });
  }
};
