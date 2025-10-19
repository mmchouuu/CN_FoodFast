import amqp from "amqplib";

export async function connectRabbitMQ(io) {
  try {
    const url = process.env.RABBITMQ_URL;
    const queue = process.env.RABBITMQ_QUEUE;
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(queue, { durable: true });

    console.log(`[socket-gateway] listening to queue: ${queue}`);

    channel.consume(queue, (msg) => {
      if (!msg) {
        return;
      }
      try {
        const data = JSON.parse(msg.content.toString());
        dispatchEvent(io, data);
      } catch (err) {
        console.error("[socket-gateway] failed to process message", err);
      } finally {
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("[socket-gateway] RabbitMQ error:", error);
  }
}

function dispatchEvent(io, message) {
  if (!message || typeof message !== "object") {
    io.emit("server-event", message);
    return;
  }

  const { event, payload, rooms } = message;
  if (!event) {
    io.emit("server-event", message);
    return;
  }

  if (Array.isArray(rooms) && rooms.length > 0) {
    rooms.forEach((room) => io.to(room).emit(event, payload));
  } else {
    io.emit(event, payload);
  }
}
