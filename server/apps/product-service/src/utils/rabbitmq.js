const amqp = require('amqplib');

const DEFAULT_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const SOCKET_QUEUE = process.env.SOCKET_QUEUE || 'socket_events';

let channel = null;
let connection = null;
let connecting = null;

const connectRabbitMQ = async () => {
  if (channel) {
    return channel;
  }

  if (connecting) {
    return connecting;
  }

  connecting = amqp
    .connect(DEFAULT_URL)
    .then(async (conn) => {
      connection = conn;
      connection.on('close', () => {
        console.error('[product-service] RabbitMQ connection closed, retrying in 5s');
        channel = null;
        connection = null;
        setTimeout(() => {
          connecting = null;
          connectRabbitMQ().catch((err) =>
            console.error('[product-service] RabbitMQ reconnect failed:', err.message),
          );
        }, 5000).unref?.();
      });

      connection.on('error', (err) => {
        console.error('[product-service] RabbitMQ connection error:', err.message);
      });

      const ch = await connection.createChannel();
      await ch.assertQueue(SOCKET_QUEUE, { durable: true });
      channel = ch;
      console.log('[product-service] Connected to RabbitMQ');
      return channel;
    })
    .catch((error) => {
      connecting = null;
      channel = null;
      connection = null;
      console.error('[product-service] RabbitMQ connection failed:', error.message);
      setTimeout(() => connectRabbitMQ().catch(() => {}), 5000).unref?.();
      throw error;
    });

  return connecting;
};

const publishSocketEvent = (event, payload, rooms = []) => {
  if (!channel) {
    console.error('[product-service] RabbitMQ channel not ready; skipping socket event:', event);
    return;
  }

  const message = {
    event,
    payload,
    rooms: Array.isArray(rooms) ? rooms : [],
    source: 'product-service',
    timestamp: new Date().toISOString(),
  };

  channel.sendToQueue(SOCKET_QUEUE, Buffer.from(JSON.stringify(message)), { persistent: false });
};

module.exports = {
  connectRabbitMQ,
  publishSocketEvent,
};
