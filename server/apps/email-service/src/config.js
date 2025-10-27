import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT || process.env.EMAIL_SERVICE_PORT || 3005);
const rabbitmqUrl =
  process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const queueName = process.env.RABBITMQ_QUEUE || 'email_queue';

const smtpPort = Number(process.env.EMAIL_PORT || 587);
const smtpSecure =
  String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' ||
  smtpPort === 465;

const smtp = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  from:
    process.env.EMAIL_FROM ||
    (process.env.EMAIL_USER
      ? `"FoodFast" <${process.env.EMAIL_USER}>`
      : '"FoodFast" <no-reply@foodfast.local>'),
};

export default {
  port,
  rabbitmqUrl,
  queueName,
  smtp,
  logLevel: process.env.LOG_LEVEL || 'info',
};
