import nodemailer from 'nodemailer';
import config from './config.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false, // dùng TLS, false cho port 587
  auth: config.smtp.auth,
});

export async function sendMail({ to, subject, text, html }) {
  try {
    const info = await transporter.sendMail({
      from: `"FoodFast" <${config.smtp.auth.user}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent to ${to}: ${info.messageId}`);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}
