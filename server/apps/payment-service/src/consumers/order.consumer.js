const { subscribeOrderEvents } = require('../utils/rabbitmq');
const paymentsService = require('../services/payments.service');
const settlementsService = require('../services/settlements.service');

async function startOrderConsumer() {
  try {
    await subscribeOrderEvents(async (message) => {
      const { event, payload } = message;
      if (!event) return;
      switch (event) {
        case 'PaymentPending':
          await paymentsService.handlePaymentPending(payload);
          break;
        case 'order.created':
          if (payload?.order_id) {
            await settlementsService.recordOrderPlacement(payload.order_id);
          }
          break;
        case 'order.status_updated':
          if (payload?.next === 'completed' && payload?.order_id) {
            await settlementsService.recordOrderCompletion(payload.order_id);
          }
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
