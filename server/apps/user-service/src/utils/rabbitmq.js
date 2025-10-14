// user-service/src/utils/rabbitmq.js

const amqp = require('amqplib');

let channel = null;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(process.env.RABBITMQ_QUEUE, { durable: true });
    console.log('✅ [user-service] Connected to RabbitMQ and queue asserted');

    // Tự động reconnect nếu connection bị đóng
    connection.on('close', () => {
      console.error('⚠️ [user-service] RabbitMQ connection closed, reconnecting...');
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (err) {
    console.error('❌ [user-service] Failed to connect to RabbitMQ:', err.message);
    setTimeout(connectRabbitMQ, 5000); // Thử lại sau 5s nếu lỗi
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

module.exports = { connectRabbitMQ, publishToEmailQueue };
