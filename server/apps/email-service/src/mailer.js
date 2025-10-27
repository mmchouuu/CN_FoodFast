import nodemailer from 'nodemailer';
import config from './config.js';

let transporter;

function createTransporter() {
  const { smtp } = config;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth?.user
      ? {
          user: smtp.auth.user,
          pass: smtp.auth.pass,
        }
      : undefined,
    tls: smtp.secure
      ? undefined
      : {
          minVersion: 'TLSv1.2',
        },
    requireTLS: !smtp.secure,
  });
}

async function ensureTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }

  try {
    await transporter.verify();
  } catch (error) {
    console.warn(
      '[email-service] SMTP verify failed, recreating transporter:',
      error?.code || error?.message,
    );
    transporter = createTransporter();
    await transporter.verify();
  }

  return transporter;
}

function buildMessage(payload = {}) {
  if (typeof payload !== 'object' || !payload) {
    throw new Error('Invalid email payload');
  }
  if (!payload.to) {
    throw new Error('Email recipient (to) is required');
  }

  const purpose = payload.purpose || 'generic';
  const subject =
    payload.subject ||
    {
      VERIFY: 'FoodFast verification code',
      RESET: 'FoodFast password reset',
      RESTAURANT_APPROVAL: 'FoodFast restaurant activation',
      OWNER_REJECTED: 'FoodFast restaurant application update',
    }[purpose] ||
    'FoodFast notification';

  let html = payload.html;
  let text = payload.text;

  if (!html && !text) {
    const otp = payload.otp || payload.code;
    if (otp) {
      text = `Your FoodFast security code is ${otp}.`;
      html = `<p>Your FoodFast security code is <strong>${otp}</strong>.</p>`;
    } else if (payload.message) {
      text = payload.message;
    } else {
      text = 'You have a new notification from FoodFast.';
    }
  }

  return {
    from: config.smtp.from,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject,
    text,
    html,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : undefined,
  };
}

export async function sendMail(payload) {
  const message = buildMessage(payload);
  const activeTransporter = await ensureTransporter();

  try {
    const info = await activeTransporter.sendMail(message);
    const recipient = Array.isArray(message.to) ? message.to.join(',') : message.to;
    const messageId = info?.messageId || info?.response || 'sent';
    console.log(`[email-service] Email sent to ${recipient}: ${messageId}`);
    return info;
  } catch (error) {
    console.error('[email-service] Failed to send email:', error);
    if (error?.code === 'ESOCKET' || error?.code === 'ECONNECTION') {
      transporter = null;
    }
    throw error;
  }
}
