import amqp from "amqplib";

const RABBITMQ_URL = "amqp://guest:guest@localhost:5672"; // vì bạn map cổng 5672 ra ngoài docker
const QUEUE = "email_queue";

async function sendTestMessage() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(QUEUE, { durable: true });

    const message = {
      to: "test@example.com",
      subject: "🎉 Test Email",
      text: "Xin chào! Đây là email test từ RabbitMQ.",
      timestamp: new Date().toISOString(),
    };

    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });

    console.log("✅ Sent test message to queue:", QUEUE);
    console.log(message);

    await channel.close();
    await connection.close();
  } catch (err) {
    console.error("❌ Error sending message:", err);
  }
}

sendTestMessage();
