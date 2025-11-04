const Stripe = require('stripe');
const config = require('../config');

let stripeInstance = null;

function getStripeClient() {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = config.STRIPE?.secretKey;
  if (!secretKey) {
    throw Object.assign(new Error('Stripe secret key is not configured'), { status: 500 });
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: config.STRIPE?.apiVersion || '2023-10-16',
  });

  return stripeInstance;
}

module.exports = {
  getStripeClient,
};
