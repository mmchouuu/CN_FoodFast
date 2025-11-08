const amqp = require('amqplib');
const config = require('../config');

let channel = null;
let connection = null;
let connecting = null;

const ensureQueue = async (ch, queueName) => {
  if (!queueName) return;
  await ch.assertQueue(queueName, { durable: true });
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

      channel = await connection.createChannel();
      await ensureQueue(channel, config.ORDER_EVENTS_QUEUE);
      if (config.PAYMENT_EVENTS_QUEUE) {
        await ensureQueue(channel, config.PAYMENT_EVENTS_QUEUE);
      }
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

const ensureQueueReady = async () => {
  const ch = await connectRabbitMQ();
  await ensureQueue(ch, config.ORDER_EVENTS_QUEUE);
  return ch;
};

const publishOrderEvent = async (eventType, payload = {}) => {
  const message = {
    event: eventType,
    payload,
    emittedAt: new Date().toISOString(),
    source: 'order-service',
  };

  const ch = await ensureQueueReady();

  ch.sendToQueue(config.ORDER_EVENTS_QUEUE, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
};

const subscribeToPaymentEvents = async (handler) => {
  if (typeof handler !== 'function') {
    throw new Error('handler must be a function');
  }

  const queueName = config.PAYMENT_EVENTS_QUEUE;
  if (!queueName) {
    throw new Error('PAYMENT_EVENTS_QUEUE is not configured');
  }

  const ch = await connectRabbitMQ();
  await ensureQueue(ch, queueName);

  await ch.consume(
    queueName,
    async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await handler(payload);
      } catch (error) {
        console.error('[order-service] payment event handler error:', error);
      } finally {
        ch.ack(msg);
      }
    },
    { noAck: false },
  );
};

module.exports = {
  connectRabbitMQ,
  ensureQueueReady,
  publishOrderEvent,
  subscribeToPaymentEvents,
};
