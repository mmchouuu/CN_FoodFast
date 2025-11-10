// user-service/src/utils/rabbitmq.js
const amqp = require('amqplib');

let channel = null;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();

    // Khai báo queue email và socket
    await channel.assertQueue(process.env.RABBITMQ_QUEUE, { durable: true });
    await channel.assertQueue('socket_events', { durable: true });

    console.log('✅ [user-service] Connected to RabbitMQ and queue asserted');

    connection.on('close', () => {
      console.error('⚠️ [user-service] RabbitMQ connection closed, reconnecting...');
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (err) {
    console.error('❌ [user-service] Failed to connect to RabbitMQ:', err.message);
    setTimeout(connectRabbitMQ, 5000);
  }
}

function publishToEmailQueue(message) {
  if (!channel) {
    console.error('❌ [user-service] RabbitMQ channel not initialized yet');
    return;
  }
  channel.sendToQueue(
    process.env.RABBITMQ_QUEUE,
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
    'socket_events',
    Buffer.from(JSON.stringify(message)),
    { persistent: false }
  );
  console.log('📢 [user-service] Sent socket event:', event);
}

module.exports = { connectRabbitMQ, publishToEmailQueue, publishSocketEvent };