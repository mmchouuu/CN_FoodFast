// libs/events/rabbit.js
const amqp = require('amqplib');

let conn = null;
let ch = null;

async function connect(url = process.env.RABBIT_URL || 'amqp://guest:guest@rabbitmq:5672') {
  if (ch) return { conn, ch };
  conn = await amqp.connect(url);
  ch = await conn.createChannel();
  return { conn, ch };
}

async function publish(exchange, routingKey, payload) {
  await connect();
  await ch.assertExchange(exchange, 'topic', { durable: true });
  const buf = Buffer.from(JSON.stringify(payload));
  return ch.publish(exchange, routingKey, buf, { persistent: true });
}

async function subscribe(exchange, routingKey, onMessage) {
  await connect();
  await ch.assertExchange(exchange, 'topic', { durable: true });
  const q = await ch.assertQueue('', { exclusive: true });
  await ch.bindQueue(q.queue, exchange, routingKey);
  ch.consume(q.queue, msg => {
    if (!msg) return;
    let content = null;
    try { content = JSON.parse(msg.content.toString()); } catch(e) { content = msg.content.toString(); }
    Promise.resolve(onMessage(content, msg)).catch(err => {
      console.error('subscribe handler error', err);
    });
    ch.ack(msg);
  }, { noAck: false });
}

module.exports = { connect, publish, subscribe };
