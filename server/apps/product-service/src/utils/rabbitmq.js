import amqp from 'amqplib';

const DEFAULT_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const SOCKET_QUEUE = process.env.SOCKET_QUEUE || 'socket_events';

let channel = null;

export async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(DEFAULT_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(SOCKET_QUEUE, { durable: true });
    console.log('[product-service] Connected to RabbitMQ');

    connection.on('close', () => {
      console.error('[product-service] RabbitMQ connection closed, retrying in 5s');
      channel = null;
      setTimeout(connectRabbitMQ, 5000).unref?.();
    });
  } catch (err) {
    console.error('[product-service] RabbitMQ connection failed:', err.message);
    channel = null;
    setTimeout(connectRabbitMQ, 5000).unref?.();
  }
}

export function publishSocketEvent(event, payload, rooms = []) {
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
  channel.sendToQueue(
    SOCKET_QUEUE,
    Buffer.from(JSON.stringify(message)),
    { persistent: false },
  );
}
