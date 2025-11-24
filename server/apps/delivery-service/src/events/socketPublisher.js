const amqp = require('amqplib');
const config = require('../config');
const logger = require('../logger');

let connection = null;
let channel = null;
let connecting = null;

const getQueueName = () => config?.rabbitmq?.socketQueue || 'socket_events';

function clearConnection() {
  connection = null;
  channel = null;
  connecting = null;
}

async function ensureChannel() {
  if (channel) {
    return channel;
  }

  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    const conn = await amqp.connect(config.rabbitmq.url);
    connection = conn;
    connection.on('close', () => {
      logger.error('[delivery-service] RabbitMQ connection closed. Next publish attempt will reconnect.');
      clearConnection();
    });
    connection.on('error', (err) => {
      logger.error('[delivery-service] RabbitMQ connection error:', err);
    });

    const ch = await conn.createChannel();
    await ch.assertQueue(getQueueName(), { durable: true });
    channel = ch;
    connecting = null;
    return ch;
  })().catch((error) => {
    logger.error('[delivery-service] Failed to establish RabbitMQ channel:', error);
    clearConnection();
    throw error;
  });

  return connecting;
}

async function publishSocketEvent(event, payload = {}, options = {}) {
  if (!event) {
    logger.error('[delivery-service] Socket event name is required');
    return;
  }

  try {
    const ch = await ensureChannel();
    const message = {
      event,
      payload,
    };
    const rooms = Array.isArray(options.rooms) ? options.rooms.filter(Boolean) : [];
    if (rooms.length) {
      message.rooms = rooms;
    }

    ch.sendToQueue(getQueueName(), Buffer.from(JSON.stringify(message)), {
      persistent: false,
      contentType: 'application/json',
    });
  } catch (error) {
    logger.error(`[delivery-service] Failed to publish socket event "${event}":`, error);
  }
}

function publishDroneUpdate(payload, options) {
  publishSocketEvent('drone:update', payload, options);
}

module.exports = {
  publishSocketEvent,
  publishDroneUpdate,
};
