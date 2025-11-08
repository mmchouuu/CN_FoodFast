const config = require('../config');
const { subscribeToPaymentEvents } = require('../utils/rabbitmq');
const ordersService = require('../services/orders.service');

async function startPaymentConsumer() {
  if (!config.PAYMENT_EVENTS_QUEUE) {
    console.warn('[order-service] PAYMENT_EVENTS_QUEUE not configured; payment consumer disabled');
    return;
  }

  try {
    await subscribeToPaymentEvents(async (message) => {
      try {
        await ordersService.handlePaymentEvent(message);
      } catch (error) {
        console.error('[order-service] payment event handling failed:', error);
      }
    });
    console.log('[order-service] Payment events consumer started');
  } catch (error) {
    console.error('[order-service] Failed to subscribe to payment events:', error);
  }
}

module.exports = {
  startPaymentConsumer,
};
