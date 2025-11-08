const paymentModel = require('../models/payment.model');
const paymentsService = require('./payments.service');
const stripeService = require('./stripe.service');
const momoService = require('./momo.service');
const config = require('../config');

const normalizeAmount = (raw) => {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw Object.assign(new Error('amount must be greater than 0'), { statusCode: 400 });
  }
  return Number(value.toFixed(2));
};

const ensureOrderId = (orderId) => {
  if (!orderId) {
    throw Object.assign(new Error('order_id is required'), { statusCode: 400 });
  }
  return orderId;
};

async function createBasePayment({
  orderId,
  userId,
  amount,
  currency,
  restaurantId,
  branchId,
  paymentMethodId,
  flow = 'online',
}) {
  return paymentModel.createPayment({
    order_id: orderId,
    user_id: userId,
    restaurant_id: restaurantId || null,
    branch_id: branchId || null,
    amount,
    currency,
    status: 'pending',
    payment_method_id: paymentMethodId || null,
    flow,
  });
}

async function createStripeIntent({
  userId,
  orderId,
  amount,
  currency,
  description,
  metadata,
  restaurantId,
  branchId,
  receiptEmail,
  customerName,
}) {
  const payment = await createBasePayment({
    orderId,
    userId,
    amount,
    currency,
    restaurantId,
    branchId,
  });

  const customerId = await stripeService.ensureCustomer({
    userId,
    email: receiptEmail,
    name: customerName,
  });

  const paymentIntent = await stripeService.createPaymentIntent({
    customerId,
    amount,
    currency,
    metadata: {
      ...(metadata || {}),
      orderId,
      paymentId: payment.id,
      userId,
    },
    description: description || `Order ${orderId}`,
    confirm: false,
    offSession: false,
    automaticPaymentMethods: true,
    receiptEmail,
  });

  await paymentModel.updatePayment(payment.id, {
    transaction_id: paymentIntent.id,
  });
  await paymentModel.insertPaymentLog({
    paymentId: payment.id,
    action: 'StripePaymentIntentCreated',
    data: { payment_intent_id: paymentIntent.id },
  });

  return {
    provider: 'stripe',
    paymentId: payment.id,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    customerId,
  };
}

async function createMomoIntent({
  userId,
  orderId,
  amount,
  currency,
  description,
  metadata,
  restaurantId,
  branchId,
  paymentMethodId,
  redirectUrl,
  ipnUrl,
}) {
  const extraData = {
    paymentId: null,
    orderId,
    userId,
    metadata: metadata || {},
  };
  const payment = await createBasePayment({
    orderId,
    userId,
    amount,
    currency,
    restaurantId,
    branchId,
    paymentMethodId,
  });
  extraData.paymentId = payment.id;

  const momoOrderId = `${orderId}-${Date.now()}`;
  const requestId = `${userId || orderId}-${Date.now()}`;

  const momoResponse = await momoService.createPaymentRequest({
    orderId: momoOrderId,
    requestId,
    amount,
    orderInfo: description || `Order ${orderId}`,
    redirectUrl: redirectUrl || config.MOMO?.redirectUrl,
    ipnUrl: ipnUrl || config.MOMO?.ipnUrl,
    extraData,
  });

  if (Number(momoResponse.resultCode) !== 0) {
    const error = new Error(momoResponse.message || 'MoMo rejected the request');
    error.statusCode = 400;
    error.details = momoResponse;
    throw error;
  }

  await paymentModel.updatePayment(payment.id, {
    transaction_id: momoResponse.orderId,
  });
  await paymentModel.insertPaymentLog({
    paymentId: payment.id,
    action: 'MoMoPaymentRequested',
    data: momoResponse,
  });

  return {
    provider: 'momo',
    paymentId: payment.id,
    orderId: momoResponse.orderId,
    requestId: momoResponse.requestId,
    payUrl: momoResponse.payUrl || momoResponse.deeplink || momoResponse.qrCodeUrl,
    deeplink: momoResponse.deeplink || momoResponse.deepLink,
    qrCodeUrl: momoResponse.qrCodeUrl || null,
    resultCode: momoResponse.resultCode,
  };
}

async function createIntent(options) {
  const provider = (options.provider || 'stripe').toLowerCase();
  const userId = options.userId;
  const orderId = ensureOrderId(options.orderId);
  const amount = normalizeAmount(options.amount);
  const currency = (options.currency || config.DEFAULT_CURRENCY || 'VND').toUpperCase();
  const description = options.description;
  const metadata = options.metadata || {};
  const restaurantId = options.restaurantId || null;
  const branchId = options.branchId || null;

  if (provider === 'momo' || provider === 'wallet') {
    return createMomoIntent({
      userId,
      orderId,
      amount,
      currency,
      description,
      metadata,
      restaurantId,
      branchId,
      paymentMethodId: options.paymentMethodId || options.walletId || null,
      redirectUrl: options.redirectUrl,
      ipnUrl: options.ipnUrl,
    });
  }

  return createStripeIntent({
    userId,
    orderId,
    amount,
    currency,
    description,
    metadata,
    restaurantId,
    branchId,
    receiptEmail: options.receiptEmail,
    customerName: options.customerName,
  });
}

async function confirmStripeIntent({ paymentIntentId }) {
  if (!paymentIntentId) {
    throw Object.assign(new Error('payment_intent_id is required'), { statusCode: 400 });
  }
  const intent = await stripeService.retrievePaymentIntent(paymentIntentId);
  const paymentId = intent.metadata?.paymentId;

  if (intent.status === 'succeeded' && paymentId) {
    await paymentsService.markPaymentSucceeded({
      paymentId,
      transactionId: intent.id,
      provider: 'stripe',
      amount: intent.amount_received ? intent.amount_received / 100 : undefined,
      currency: intent.currency ? intent.currency.toUpperCase() : undefined,
      metadata: intent.metadata,
    });
  }

  return {
    provider: 'stripe',
    status: intent.status,
    paymentId: paymentId || null,
    paymentIntentId: intent.id,
  };
}

async function confirmMomoPayment({ orderId, requestId }) {
  if (!orderId) {
    throw Object.assign(new Error('orderId is required'), { statusCode: 400 });
  }
  const result = await momoService.queryTransaction({ orderId, requestId });
  const extraData = momoService.decodeExtraData(result.extraData) || {};

  if (!extraData.paymentId) {
    const payment = await paymentModel.findPaymentByTransactionId(orderId);
    if (payment) {
      extraData.paymentId = payment.id;
    }
  }

  const payload = {
    provider: 'momo',
    status: result.resultCode === 0 ? 'succeeded' : 'failed',
    result,
    paymentId: extraData.paymentId || null,
    orderId: result.orderId,
    requestId: result.requestId,
  };

  if (result.resultCode === 0 && extraData.paymentId) {
    await paymentsService.markPaymentSucceeded({
      paymentId: extraData.paymentId,
      transactionId: result.transId || result.orderId,
      provider: 'momo',
      amount: Number(result.amount) || undefined,
      currency: (result.currency || config.DEFAULT_CURRENCY || 'VND').toUpperCase(),
      metadata: extraData,
    });
  } else if (extraData.paymentId) {
    await paymentsService.markPaymentFailed({
      paymentId: extraData.paymentId,
      transactionId: result.transId || result.orderId,
      provider: 'momo',
      reason: result.message || 'payment_failed',
      metadata: result,
    });
  }

  return payload;
}

async function confirmPayment(options) {
  const provider = (options.provider || '').toLowerCase();
  if (provider === 'momo') {
    return confirmMomoPayment(options);
  }
  return confirmStripeIntent(options);
}

module.exports = {
  createIntent,
  confirmPayment,
};
