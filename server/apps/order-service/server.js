// import dotenv from 'dotenv';
// import app from './src/app.js';
// import { connectRabbitMQ } from './src/utils/rabbitmq.js';

// dotenv.config();

// const PORT = process.env.PORT || 3003;

// app.listen(PORT, async () => {
//   console.log(`Order Service running on port ${PORT}`);
//   await connectRabbitMQ();
// });

const dotenv = require('dotenv');
const app = require('./src/app');
const { connectRabbitMQ } = require('./src/utils/rabbitmq');
const { pool } = require('./src/db');

dotenv.config();

const PORT = Number(process.env.PORT) || 3003;

const waitForPostgres = async () => {
  let connected = false;
  while (!connected) {
    try {
      await pool.query('SELECT 1');
      console.log('[order-service] Connected to Postgres');
      connected = true;
    } catch (err) {
      console.log('Waiting for Postgres at orderdb:5432...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

const startServer = async () => {
  await waitForPostgres();

  try {
    await connectRabbitMQ();
    console.log('[order-service] RabbitMQ connected');
  } catch (error) {
    console.error('[order-service] RabbitMQ connection issue:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('[order-service] Failed to start service:', error);
  process.exit(1);
});
