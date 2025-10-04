const amqp = require('amqplib');

let channel = null;
async function connect() {
  if (channel) return channel;
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await conn.createChannel();
  await channel.assertExchange('foodfast_events', 'topic', { durable: true });
  return channel;
}

async function publishPaymentEvent({ payment_id, order_id, amount, transaction_id }) {
  const ch = await connect();
  const event = {
    type: 'PaymentCompleted',
    data: { payment_id, order_id, amount: String(amount), transaction_id, occurred_at: new Date().toISOString() }
  };
  const routingKey = 'payment.completed';
  ch.publish('foodfast_events', routingKey, Buffer.from(JSON.stringify(event)), { persistent: true });
  console.log('published PaymentCompleted', event);
}

async function start() {
  // lazy connect
  await connect();
  console.log('payment publisher ready');
}

module.exports = { connect, publishPaymentEvent, startPublisher: start };
