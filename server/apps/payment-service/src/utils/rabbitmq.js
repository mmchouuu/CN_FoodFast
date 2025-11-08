const amqp = require('amqplib');
const config = require('../config');

let connection = null;
let channel = null;
let connecting = null;

const ensureQueue = async (queue) => {
  if (!queue) return;
  await channel.assertQueue(queue, { durable: true });
};

const connect = async () => {
  if (channel) {
    return channel;
  }
  if (connecting) {
    return connecting;
  }

  connecting = amqp
    .connect(config.RABBITMQ_URL)
    .then(async (conn) => {
      connection = conn;
      connection.on('close', () => {
        console.error('[payment-service] RabbitMQ connection closed, retrying in 5s');
        connection = null;
        channel = null;
        setTimeout(() => {
          connecting = null;
          connect().catch((err) =>
            console.error('[payment-service] RabbitMQ reconnect failed:', err.message),
          );
        }, 5000).unref?.();
      });
      connection.on('error', (err) => {
        console.error('[payment-service] RabbitMQ error:', err.message);
      });

      channel = await connection.createChannel();
      await ensureQueue(config.ORDER_EVENTS_QUEUE);
      await ensureQueue(config.PAYMENT_EVENTS_QUEUE);
      console.log('[payment-service] RabbitMQ channel ready');
      return channel;
    })
    .catch((error) => {
      connecting = null;
      console.error('[payment-service] RabbitMQ connection failed:', error.message);
      setTimeout(() => connect().catch(() => {}), 5000).unref?.();
      throw error;
    });

  return connecting;
};

const ensureChannel = async () => {
  const ch = await connect();
  await ensureQueue(config.PAYMENT_EVENTS_QUEUE);
  return ch;
};

const publishPaymentEvent = async (eventType, payload = {}) => {
  if (!config.PAYMENT_EVENTS_QUEUE) {
    return;
  }

  const ch = await ensureChannel();
  const message = {
    event: eventType,
    payload,
    emittedAt: new Date().toISOString(),
    source: 'payment-service',
  };

  ch.sendToQueue(config.PAYMENT_EVENTS_QUEUE, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
};

const subscribeOrderEvents = async (handler) => {
  if (typeof handler !== 'function') {
    throw new Error('handler must be a function');
  }

  const ch = await connect();
  await ensureQueue(config.ORDER_EVENTS_QUEUE);

  await ch.consume(
    config.ORDER_EVENTS_QUEUE,
    async (msg) => {
      if (!msg) return;
      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
      } catch (error) {
        console.error('[payment-service] Failed to process order event:', error);
      } finally {
        ch.ack(msg);
      }
    },
    { noAck: false },
  );
};

module.exports = {
  publishPaymentEvent,
  subscribeOrderEvents,
  ensureChannel,
};
