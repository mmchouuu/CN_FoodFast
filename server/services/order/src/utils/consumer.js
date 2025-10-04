const amqp = require('amqplib');
const { Order } = require('../models');

async function startConsumer() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange('foodfast_events', 'topic', { durable: true });
  const q = await ch.assertQueue('order_payment_queue', { durable: true });
  await ch.bindQueue(q.queue, 'foodfast_events', 'payment.completed');

  ch.consume(q.queue, async (msg) => {
    if (!msg) return;
    const event = JSON.parse(msg.content.toString());
    console.log("Order Service got event:", event);
    if (event.type === 'PaymentCompleted') {
      const { order_id } = event.data;
      const order = await Order.findByPk(order_id);
      if (order) {
        order.status = 'paid';
        await order.save();
        console.log('Order updated to paid:', order.id);
      }
    }
    ch.ack(msg);
  });

  console.log("Order consumer subscribed to payment.completed");
}

module.exports = { startConsumer };
