import amqp from 'amqplib';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3005;
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE = process.env.RABBITMQ_QUEUE;

// Config mail transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // Gmail dùng TLS, không cần true
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Kiểm tra gửi mail
async function sendMail({ to, subject, text, html }) {
  const info = await transporter.sendMail({
    from: `"TastyQueen 🍔" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
  console.log('📧 Email sent:', info.messageId);
}

// Lắng nghe RabbitMQ queue
async function start() {
  try {
    console.log('🚀 Starting Email Service...');
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(QUEUE, { durable: true });

    console.log(`✅ Connected to RabbitMQ, listening on queue: ${QUEUE}`);

    channel.consume(
      QUEUE,
      async (msg) => {
        if (msg !== null) {
          const content = JSON.parse(msg.content.toString());
          console.log('📨 Received message:', content);

          await sendMail({
            to: content.to,
            subject: content.subject,
            text: content.text,
            html: content.html,
          });

          channel.ack(msg);
        }
      },
      { noAck: false }
    );
  } catch (err) {
    console.error('❌ Email service error:', err);
    process.exit(1);
  }
}

start();

console.log(`📡 Email service is running on port ${PORT}`);
