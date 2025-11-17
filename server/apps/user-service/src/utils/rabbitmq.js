// user-service/src/utils/rabbitmq.js
const amqp = require('amqplib');

const EMAIL_QUEUE = process.env.RABBITMQ_QUEUE || 'email_queue';
const SOCKET_QUEUE = process.env.RABBITMQ_SOCKET_QUEUE || 'socket_events';
const RESTAURANT_EVENTS_QUEUE = process.env.RESTAURANT_EVENTS_QUEUE || 'restaurant_events';

let channel = null;
let connection = null;
const consumerSetups = [];
let reconnectTimer = null;

const scheduleReconnect = () => {
  if (reconnectTimer) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRabbitMQ().catch((err) => {
      console.error('❌ [user-service] RabbitMQ reconnect failed:', err.message);
    });
  }, 5000);
};

async function connectRabbitMQ() {
  if (channel) {
    return channel;
  }
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    if (EMAIL_QUEUE) {
      await channel.assertQueue(EMAIL_QUEUE, { durable: true });
    }
    if (SOCKET_QUEUE) {
      await channel.assertQueue(SOCKET_QUEUE, { durable: true });
    }
    if (RESTAURANT_EVENTS_QUEUE) {
      await channel.assertQueue(RESTAURANT_EVENTS_QUEUE, { durable: true });
    }

    console.log('✅ [user-service] Connected to RabbitMQ and queues asserted');

    connection.on('close', () => {
      console.error('⚠️ [user-service] RabbitMQ connection closed, reconnecting...');
      channel = null;
      connection = null;
      scheduleReconnect();
    });
    connection.on('error', (err) => {
      console.error('⚠️ [user-service] RabbitMQ connection error:', err.message);
    });

    consumerSetups.forEach((setup) => {
      try {
        setup(channel);
      } catch (err) {
        console.error('⚠️ [user-service] Failed to bootstrap consumer:', err.message);
      }
    });

    return channel;
  } catch (err) {
    channel = null;
    connection = null;
    console.error('❌ [user-service] Failed to connect to RabbitMQ:', err.message);
    scheduleReconnect();
    throw err;
  }
}

function publishToEmailQueue(message) {
  if (!channel) {
    console.error('❌ [user-service] RabbitMQ channel not initialized yet');
    return;
  }
  channel.sendToQueue(
    EMAIL_QUEUE,
    Buffer.from(JSON.stringify(message)),
    { persistent: true }
  );
  console.log('📨 [user-service] Published email job to queue:', message.to);
}

function publishSocketEvent(event, payload) {
  if (!channel) {
    console.error('❌ [user-service] RabbitMQ channel not initialized yet');
    return;
  }
  const message = { event, payload };
  channel.sendToQueue(
    SOCKET_QUEUE,
    Buffer.from(JSON.stringify(message)),
    { persistent: false }
  );
  console.log('📢 [user-service] Sent socket event:', event);
}

async function subscribeRestaurantEvents(handler) {
  if (!RESTAURANT_EVENTS_QUEUE) {
    throw new Error('RESTAURANT_EVENTS_QUEUE is not configured');
  }
  if (typeof handler !== 'function') {
    throw new Error('handler must be a function');
  }

  const consumeWithChannel = (ch) => {
    ch.consume(
      RESTAURANT_EVENTS_QUEUE,
      async (msg) => {
        if (!msg) return;
        let content = null;
        try {
          content = JSON.parse(msg.content.toString());
        } catch (error) {
          console.error('⚠️ [user-service] Failed to parse restaurant event message:', error.message);
          ch.ack(msg);
          return;
        }
        try {
          await handler(content);
        } catch (error) {
          console.error('⚠️ [user-service] Restaurant event handler failed:', error);
        } finally {
          ch.ack(msg);
        }
      },
      { noAck: false },
    );
  };

  consumerSetups.push(consumeWithChannel);
  const activeChannel = channel || (await connectRabbitMQ().catch(() => null));
  if (activeChannel) {
    consumeWithChannel(activeChannel);
  }
}

module.exports = {
  connectRabbitMQ,
  publishToEmailQueue,
  publishSocketEvent,
  subscribeRestaurantEvents,
};
