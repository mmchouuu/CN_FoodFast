const { subscribeToOrderEvents } = require('../utils/rabbitmq');
const { handleOrderCreated } = require('../services/orderAssignment.service');
const logger = require('../logger');

async function startOrderEventsConsumer() {
  try {
    await subscribeToOrderEvents(async (message) => {
      if (!message || typeof message !== 'object') {
        return;
      }
      const eventType = (message.event || message.event_type || message.type || '').toLowerCase();
      const payload = message.payload || {};
      const normalizedNext =
        typeof payload.next === 'string' ? payload.next.toLowerCase() : null;

      const shouldHandle =
        eventType === 'order.created' ||
        (eventType === 'order.status_updated' &&
          normalizedNext &&
          (normalizedNext === 'confirmed' || normalizedNext === 'ready'));

      if (!shouldHandle) {
        return;
      }

      try {
        await handleOrderCreated(payload);
      } catch (error) {
        logger.error('[delivery-service] Error handling order assignment event:', error);
      }
    });
  } catch (error) {
    logger.error('[delivery-service] Failed to start order events consumer:', error);
  }
}

module.exports = {
  startOrderEventsConsumer,
};
