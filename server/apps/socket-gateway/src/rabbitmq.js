import amqp from "amqplib";

export async function connectRabbitMQ(io) {
  try {
    const url = process.env.RABBITMQ_URL;
    const queue = process.env.RABBITMQ_QUEUE;
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });

    console.log(`✅ Connected to RabbitMQ, listening on queue: ${queue}`);

    channel.consume(queue, (msg) => {
      if (msg !== null) {
        const data = JSON.parse(msg.content.toString());
        console.log("📡 Received socket event:", data);

        // Phát ra cho tất cả client đang kết nối
        io.emit("server-event", data);
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("❌ RabbitMQ error:", error);
  }
}
