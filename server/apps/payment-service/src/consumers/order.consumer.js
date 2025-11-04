const { subscribeOrderEvents } = require('../utils/rabbitmq');
const paymentsService = require('../services/payments.service');

async function startOrderConsumer() {
  try {
    await subscribeOrderEvents(async (message) => {
      const { event, payload } = message;
      if (!event) return;
      switch (event) {
        case 'PaymentPending':
          await paymentsService.handlePaymentPending(payload);
          break;
        default:
          break;
      }
    });
    console.log('[payment-service] Order events consumer started');
  } catch (error) {
    console.error('[payment-service] Failed to start order consumer:', error);
  }
}

module.exports = {
  startOrderConsumer,
};
