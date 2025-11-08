const paymentMethodModel = require('../models/paymentMethod.model');
const stripeService = require('./stripe.service');

const sanitizeBoolean = (value) => value === true || value === 'true';

async function createStripeSetupIntent({ userId, email, name }) {
  if (!userId) {
    throw Object.assign(new Error('user id is required'), { statusCode: 400 });
  }

  const customerId = await stripeService.ensureCustomer({ userId, email, name });
  const intent = await stripeService.createSetupIntent({ customerId });

  return {
    client_secret: intent.client_secret,
    customer_id: customerId,
  };
}

async function confirmStripePaymentMethod({
  userId,
  paymentMethodId,
  customerId,
  makeDefault = false,
}) {
  if (!userId) {
    throw Object.assign(new Error('user id is required'), { statusCode: 400 });
  }
  if (!paymentMethodId) {
    throw Object.assign(new Error('payment_method_id is required'), { statusCode: 400 });
  }
  if (!customerId) {
    throw Object.assign(new Error('stripe customer id is required'), { statusCode: 400 });
  }

  const paymentMethod = await stripeService.attachPaymentMethod({
    customerId,
    paymentMethodId,
    setDefault: makeDefault,
  });

  const card = paymentMethod.card || {};
  const stored = await paymentMethodModel.upsertStripeCard({
    userId,
    customerId,
    paymentMethodId,
    last4: card.last4 || null,
    brand: card.brand || paymentMethod.brand || null,
    expMonth: card.exp_month || null,
    expYear: card.exp_year || null,
    isDefault: makeDefault,
  });

  return {
    id: stored.id,
    brand: stored.brand,
    last4: stored.last4,
    exp_month: stored.exp_month,
    exp_year: stored.exp_year,
    is_default: stored.is_default,
    provider_data: stored.provider_data,
    created_at: stored.created_at,
  };
}

async function listCustomerPaymentMethods(userId) {
  const rows = await paymentMethodModel.listStripePaymentMethods(userId);
  return rows.map((row) => ({
    id: row.id,
    brand: row.brand,
    last4: row.last4,
    exp_month: row.exp_month,
    exp_year: row.exp_year,
    is_default: row.is_default,
    provider_data: row.provider_data,
    created_at: row.created_at,
  }));
}

module.exports = {
  createStripeSetupIntent,
  confirmStripePaymentMethod,
  listCustomerPaymentMethods,
  sanitizeBoolean,
};
