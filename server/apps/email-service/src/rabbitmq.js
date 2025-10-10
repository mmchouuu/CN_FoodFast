import amqp from 'amqplib';
import config from './config.js';
import { sendMail } from './mailer.js';

export async function startRabbitMQ() {
  try {
    const conn = await amqp.connect(config.rabbitmqUrl);
    const channel = await conn.createChannel();
    await channel.assertQueue(config.queueName, { durable: true });

    console.log(`✅ Connected to RabbitMQ, listening on queue: ${config.queueName}`);

    channel.consume(config.queueName, async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          console.log('📩 Received message:', content);
          await sendMail(content);
          channel.ack(msg);
        } catch (err) {
          console.error('❌ Error processing message:', err.message);
          channel.nack(msg, false, false); // loại bỏ message lỗi
        }
      }
    });
  } catch (err) {
    console.error('❌ RabbitMQ connection error:', err.message);
  }
}
