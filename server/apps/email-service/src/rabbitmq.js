import amqp from 'amqplib';
import config from './config.js';
import { sendMail } from './mailer.js';

export async function startRabbitMQ() {
  const url = config.rabbitmqUrl;
  const queue = config.queueName;

  try {
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });

    console.log(`[email-service] Listening for messages on queue: ${queue}`);

    channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;
        let content;
        try {
          content = JSON.parse(msg.content.toString());
        } catch (error) {
          console.error('[email-service] Invalid message payload, discarding');
          channel.ack(msg);
          return;
        }

        try {
          await sendMail(content);
          channel.ack(msg);
        } catch (error) {
          const policy = String(process.env.EMAIL_REQUEUE_POLICY || '').toLowerCase();
          const requeue = policy !== 'drop';
          console.error('[email-service] Email delivery failed:', error?.message || error);
          channel.nack(msg, false, requeue);
        }
      },
      { noAck: false },
    );

    connection.on('close', () => {
      console.error('[email-service] RabbitMQ connection closed, exiting');
      process.exit(1);
    });

    connection.on('error', (error) => {
      console.error('[email-service] RabbitMQ error:', error?.message || error);
    });
  } catch (error) {
    console.error('[email-service] Failed to connect to RabbitMQ:', error?.message || error);
    process.exit(1);
  }
}
