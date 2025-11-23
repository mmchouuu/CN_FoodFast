const amqp = require('amqplib');
const config = require('../config');
const logger = require('../logger');

let connection = null;
let channel = null;
let connecting = null;

async function ensureConnection() {
  if (channel) {
    return channel;
  }
  if (connecting) {
    return connecting;
  }

  connecting = amqp
    .connect(config.rabbitmq.url)
    .then(async (conn) => {
      connection = conn;
      connection.on('error', (error) => {
        logger.error('[delivery-service] RabbitMQ connection error:', error.message);
      });
      connection.on('close', () => {
        logger.error('[delivery-service] RabbitMQ connection closed. Reconnecting...');
        connection = null;
        channel = null;
        setTimeout(() => {
          connecting = null;
          ensureConnection().catch((err) => {
            logger.error('[delivery-service] RabbitMQ reconnect failed:', err.message);
          });
        }, 5000).unref?.();
      });

      channel = await connection.createChannel();
      if (config.rabbitmq.orderQueue) {
        await channel.assertQueue(config.rabbitmq.orderQueue, { durable: true });
      }
      logger.info('[delivery-service] RabbitMQ channel ready');
      return channel;
    })
    .catch((error) => {
      connecting = null;
      logger.error('[delivery-service] RabbitMQ connection failed:', error.message);
      setTimeout(() => {
        ensureConnection().catch(() => {});
      }, 5000).unref?.();
      throw error;
    });

  return connecting;
}

async function subscribeToOrderEvents(handler) {
  if (typeof handler !== 'function') {
    throw new Error('handler must be a function');
  }
  if (!config.rabbitmq.orderQueue) {
    throw new Error('ORDER_EVENTS_QUEUE is not configured');
  }

  const ch = await ensureConnection();
  await ch.consume(
    config.rabbitmq.orderQueue,
    async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await handler(payload);
      } catch (error) {
        logger.error('[delivery-service] order event handler failed:', error);
      } finally {
        ch.ack(msg);
      }
    },
    { noAck: false },
  );
  logger.info('[delivery-service] Subscribed to order events queue');
}

module.exports = {
  subscribeToOrderEvents,
};
