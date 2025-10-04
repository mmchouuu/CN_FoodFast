const amqp = require("amqplib");

let channel = null;
let connection = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";

/**
 * Kết nối RabbitMQ và khởi tạo channel
 */
async function connectRabbitMQ() {
  if (channel) return channel;
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log("[Product Service] Connected to RabbitMQ");
    return channel;
  } catch (err) {
    console.error("[Product Service] RabbitMQ connection error:", err);
    throw err;
  }
}

/**
 * Gửi event vào exchange "foodfast_events"
 * @param {string} eventType - Kiểu sự kiện (vd: ProductCreated, RestaurantCreated)
 * @param {Object} payload - Dữ liệu sự kiện
 */
async function publishEvent(eventType, payload) {
  try {
    const ch = await connectRabbitMQ();
    const exchange = "foodfast_events";

    await ch.assertExchange(exchange, "topic", { durable: true });

    const routingKey = `product.${eventType}`; // ví dụ: product.created
    const msg = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    ch.publish(exchange, routingKey, Buffer.from(msg), { persistent: true });

    console.log(`[Product Service] Event published: ${routingKey}`);
  } catch (err) {
    console.error("[Product Service] Error publishing event:", err);
  }
}

/**
 * Đóng kết nối RabbitMQ khi service shutdown
 */
async function closeRabbitMQ() {
  try {
    await channel?.close();
    await connection?.close();
    console.log("[Product Service] RabbitMQ connection closed");
  } catch (err) {
    console.error("[Product Service] Error closing RabbitMQ:", err);
  }
}

module.exports = {
  connectRabbitMQ,
  publishEvent,
  closeRabbitMQ,
};
