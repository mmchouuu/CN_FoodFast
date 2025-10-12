const amqp = require("amqplib");

let channel;

/**
 * Connect RabbitMQ và tạo exchange chính
 */
async function connect(url = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672") {
  const conn = await amqp.connect(url);
  channel = await conn.createChannel();
  await channel.assertExchange("foodfast_events", "topic", { durable: true });
  console.log("Event bus connected");
  return channel;
}

/**
 * Publish event lên RabbitMQ
 */
function publish(routingKey, message) {
  if (!channel) throw new Error("Event bus chưa connect. Gọi connect() trước.");
  channel.publish("foodfast_events", routingKey, Buffer.from(JSON.stringify(message)), {
    persistent: true
  });
  console.log(`Published event: ${routingKey}`, message);
}

/**
 * Subscribe event từ RabbitMQ
 */
async function subscribe(routingKey, handler) {
  if (!channel) throw new Error("Event bus chưa connect. Gọi connect() trước.");
  const q = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(q.queue, "foodfast_events", routingKey);

  channel.consume(q.queue, (msg) => {
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      console.log(`Received event: ${routingKey}`, data);
      handler(data);
      channel.ack(msg);
    }
  });
}

module.exports = { connect, publish, subscribe };
