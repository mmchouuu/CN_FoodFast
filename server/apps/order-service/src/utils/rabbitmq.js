const amqp = require('amqplib');
const config = require('../config');

let channel = null;
let connection = null;
let connecting = null;

const ensureQueue = async (ch) => {
  await ch.assertQueue(config.ORDER_EVENTS_QUEUE, { durable: true });
};

const createConnection = async () => {
  if (connecting) {
    return connecting;
  }

  connecting = amqp
    .connect(config.RABBITMQ_URL)
    .then(async (conn) => {
      connection = conn;
      connection.on('close', () => {
        console.error('[order-service] RabbitMQ connection closed, retrying in 5s');
        channel = null;
        connection = null;
        setTimeout(() => {
          connecting = null;
          createConnection().catch((err) =>
            console.error('[order-service] RabbitMQ reconnect failed:', err.message),
          );
        }, 5000).unref?.();
      });

      connection.on('error', (err) => {
        console.error('[order-service] RabbitMQ connection error:', err.message);
      });

      const ch = await connection.createChannel();
      await ensureQueue(ch);
      channel = ch;
      console.log('[order-service] RabbitMQ channel ready');
      return channel;
    })
    .catch((error) => {
      connecting = null;
      console.error('[order-service] RabbitMQ connection failed:', error.message);
      setTimeout(() => createConnection().catch(() => {}), 5000).unref?.();
      throw error;
    });

  return connecting;
};

const connectRabbitMQ = async () => {
  if (channel) {
    return channel;
  }
  return createConnection();
};

const publishOrderEvent = async (eventType, payload = {}) => {
  const message = {
    event: eventType,
    payload,
    emittedAt: new Date().toISOString(),
    source: 'order-service',
  };

  if (!channel) {
    throw new Error('RabbitMQ channel not ready');
  }

  channel.sendToQueue(config.ORDER_EVENTS_QUEUE, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
};

module.exports = {
  connectRabbitMQ,
  publishOrderEvent,
};
