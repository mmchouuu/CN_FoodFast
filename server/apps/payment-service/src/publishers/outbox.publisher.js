const { publishPaymentEvent } = require('../utils/rabbitmq');

async function publishEvent(eventType, payload = {}) {
  try {
    await publishPaymentEvent(eventType, payload);
  } catch (error) {
    console.error('[payment-service] Failed to publish payment event:', error);
  }
}

module.exports = {
  publishEvent,
};
