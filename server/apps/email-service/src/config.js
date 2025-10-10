import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3005,
  rabbitmqUrl: process.env.RABBITMQ_URL,
  queueName: process.env.RABBITMQ_QUEUE || 'email_queue',
  smtp: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  },
};
