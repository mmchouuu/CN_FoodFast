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
  await stripeClient.paymentMethods.attach(paymentMethodId, { customer: customerId });
  if (setDefault) {
    await stripeClient.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }
  return stripeClient.paymentMethods.retrieve(paymentMethodId);
}

async function createPaymentIntent({
  customerId,
  paymentMethodId,
  amount,
  currency = config.DEFAULT_CURRENCY || 'VND',
  metadata = {},
  description,
}) {
  assertStripe();

  const paymentIntent = await stripeClient.paymentIntents.create({
    amount: getMinorUnitAmount(amount, currency),
    currency: currency.toLowerCase(),
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    off_session: true,
    description,
    metadata,
  });

  return paymentIntent;
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
};
