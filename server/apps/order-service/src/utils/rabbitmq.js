import amqp from 'amqplib';

let channel;

export const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
    channel = await connection.createChannel();
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.error('RabbitMQ connection failed:', err);
  }
};

export const publishMessage = async (queue, message) => {
  if (!channel) return;
  await channel.assertQueue(queue);
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
};
