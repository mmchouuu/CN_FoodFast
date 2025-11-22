require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');
const deliveryRoutes = require('./routes');
const deliveryService = require('./services/delivery.service');
const logger = require('./logger');

const app = express();

const corsOrigins = config.cors.origin;
const allowAllOrigins = corsOrigins.length === 1 && corsOrigins[0] === '*';

app.disable('x-powered-by');
app.use(
  cors({
    origin: allowAllOrigins ? '*' : corsOrigins,
    credentials: !allowAllOrigins,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  const status = await deliveryService.getSystemStatus();
  res.json({ status: 'ok', details: status });
});

app.use('/api/deliveries', deliveryRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('[delivery-service] Unhandled error:', err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
  });
});

const port = config.port;

app.listen(port, () => {
  logger.info(`[delivery-service] Listening on port ${port}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[delivery-service] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('[delivery-service] Uncaught exception:', error);
});
