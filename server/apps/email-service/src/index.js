import express from 'express';
import config from './config.js';
import { startRabbitMQ } from './rabbitmq.js';

const app = express();

// const PORT = Number(process.env.PORT) || 3005;
// const RABBITMQ_URL = process.env.RABBITMQ_URL;
// const QUEUE = process.env.RABBITMQ_QUEUE || 'email_queue';
// const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
// const EMAIL_PORT = Number(process.env.EMAIL_PORT) || 587;
// const EMAIL_SECURE =
//   String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' ||
//   EMAIL_PORT === 465;
// const EMAIL_USER = process.env.EMAIL_USER;
// const EMAIL_PASS = process.env.EMAIL_PASS;

// const createTransporter = () =>
//   nodemailer.createTransport({
//     host: EMAIL_HOST,
//     port: EMAIL_PORT,
//     secure: EMAIL_SECURE,
//     auth: {
//       user: EMAIL_USER,
//       pass: EMAIL_PASS,
//     },
//     tls: EMAIL_SECURE
//       ? undefined
//       : {
//           minVersion: 'TLSv1.2',
//         },
//     requireTLS: !EMAIL_SECURE,
//   });

// let transporter = createTransporter();

// async function ensureTransporter() {
//   try {
//     await transporter.verify();
//     return transporter;
//   } catch (error) {
//     console.warn('SMTP verify failed, recreating transporter', error?.code || error?.message);
//     transporter = createTransporter();
//     await transporter.verify();
//     return transporter;
//   }
// }

// async function sendMail({ to, subject, text, html }) {
//   const activeTransporter = await ensureTransporter();
//   try {
//     const info = await activeTransporter.sendMail({
//       from: `"FoodFast" <${EMAIL_USER}>`,
//       to,
//       subject,
//       text,
//       html,
//     });
//     console.log('📧 Email sent:', info.messageId);
//     return info;
//   } catch (error) {
//     console.error('❌ Failed to send email:', error);
//     if (error?.code === 'ESOCKET' || error?.code === 'ECONNECTION') {
//       transporter = createTransporter();
//     }
//     throw error;
//   }
// }

// async function start() {
//   try {
//     console.log('🚀 Starting Email Service...');
//     const conn = await amqp.connect(RABBITMQ_URL);
//     const channel = await conn.createChannel();
//     await channel.assertQueue(QUEUE, { durable: true });

//     console.log(`✅ Connected to RabbitMQ, listening on queue: ${QUEUE}`);

//     channel.consume(
//       QUEUE,
//       async (msg) => {
//         if (!msg) return;
//         const content = JSON.parse(msg.content.toString());
//         console.log('📨 Received message:', content);
//         try {
//           await sendMail(content);
//           channel.ack(msg);
//         } catch (error) {
//           console.error('⚠️ Email send error, message requeued');
//           channel.nack(msg, false, true);
//         }
//       },
//       { noAck: false }
//     );
//   } catch (err) {
//     console.error('💥 Email service error:', err);
//     process.exit(1);
//   }
// }

// process.on('unhandledRejection', (reason) => {
//   console.error('Unhandled rejection in email service:', reason);
// });

// start();
// console.log(`📡 Email service is running on port ${PORT}`);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(config.port, () => {
  console.log(`[email-service] HTTP listening on port ${config.port}`);
});

startRabbitMQ().catch((error) => {
  console.error('[email-service] RabbitMQ bootstrap failed:', error);
  process.exit(1);
});
