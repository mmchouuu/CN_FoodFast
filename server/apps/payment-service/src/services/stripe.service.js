// payment-service/src/services/stripe.service.js
const Stripe = require('stripe');
const config = require('../config');
const paymentMethodModel = require('../models/paymentMethod.model');

const stripeClient = config.STRIPE_SECRET_KEY
  ? new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const assertStripe = () => {
  if (!stripeClient) {
    throw new Error('Stripe secret key not configured');
  }
};

const getMinorUnitAmount = (amount, currency) => {
  const normalized = Number(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('amount must be greater than 0');
  }
  const upperCurrency = (currency || config.DEFAULT_CURRENCY || 'VND').toLowerCase();
  const zeroDecimalCurrencies = new Set(['vnd', 'jpy', 'krw']);
  if (zeroDecimalCurrencies.has(upperCurrency)) {
    return Math.round(normalized);
  }
  return Math.round(normalized * 100);
};

async function ensureCustomer({ userId, email, name } = {}) {
  assertStripe();
  if (!userId) {
    throw new Error('userId is required to ensure stripe customer');
  }

  const existing = await paymentMethodModel.findStripeCustomer(userId);
  if (existing?.customer_id) {
    return existing.customer_id;
  }

  const customer = await stripeClient.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: {
      userId,
    },
  });

  return customer.id;
}

async function createSetupIntent({ customerId, paymentMethodTypes = ['card'] }) {
  assertStripe();
  return stripeClient.setupIntents.create({
    customer: customerId,
    payment_method_types: paymentMethodTypes,
  });
}

async function attachPaymentMethod({ customerId, paymentMethodId, setDefault = true }) {
  assertStripe();
  let paymentMethod;
  try {
    paymentMethod = await stripeClient.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  } catch (error) {
    const alreadyAttached =
      error?.code === 'resource_already_exists' || error?.raw?.code === 'resource_already_exists';
    if (!alreadyAttached) {
      throw error;
    }
    // confirmCardSetup already attaches the method; fall back to retrieving it
    paymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId);
  }

  const attachedCustomerId =
    typeof paymentMethod.customer === 'string'
      ? paymentMethod.customer
      : paymentMethod.customer?.id;

  if (attachedCustomerId && attachedCustomerId !== customerId) {
    const conflictError = new Error('payment method belongs to another customer');
    conflictError.statusCode = 409;
    conflictError.details = { attachedCustomerId };
    throw conflictError;
  }
  if (setDefault) {
    await stripeClient.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }
  return paymentMethod;

}

async function createPaymentIntent({
  customerId,
  paymentMethodId,
  amount,
  currency = config.DEFAULT_CURRENCY || 'VND',
  metadata = {},
  description,
  confirm = true,
  offSession = true,
  automaticPaymentMethods = false,
  receiptEmail,
}) {
  assertStripe();

  const params = {
    amount: getMinorUnitAmount(amount, currency),
    currency: currency.toLowerCase(),
    customer: customerId,
    metadata,
    description,
    confirm,
  };

  if (paymentMethodId) {
    params.payment_method = paymentMethodId;
  }
  if (automaticPaymentMethods) {
    params.automatic_payment_methods = { enabled: true };
  }
  if (confirm) {
    params.off_session = offSession;
  }
  if (receiptEmail) {
    params.receipt_email = receiptEmail;
  }

  const paymentIntent = await stripeClient.paymentIntents.create(params);
  return paymentIntent;
}

async function retrievePaymentIntent(paymentIntentId) {
  assertStripe();
  if (!paymentIntentId) {
    throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400 });
  }
  return stripeClient.paymentIntents.retrieve(paymentIntentId);
}

function constructWebhookEvent(rawBody, signature) {
  assertStripe();
  if (!config.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret not configured');
  }
  return stripeClient.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);
}

async function refundPaymentIntent({ paymentIntentId, amount, currency, reason }) {
  assertStripe();
  const params = {
    payment_intent: paymentIntentId,
  };

  if (amount) {
    params.amount = getMinorUnitAmount(amount, currency || config.DEFAULT_CURRENCY);
  }

  if (reason) {
    params.reason = reason;
  }

  return stripeClient.refunds.create(params);
}

module.exports = {
  ensureCustomer,
  createSetupIntent,
  attachPaymentMethod,
  createPaymentIntent,
  refundPaymentIntent,
  retrievePaymentIntent,
  constructWebhookEvent,
};
