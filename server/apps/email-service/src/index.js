import express from 'express';
import config from './config.js';
import { startRabbitMQ } from './rabbitmq.js';

const app = express();

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
