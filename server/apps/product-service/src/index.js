require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const config = require('./config');
const { connectRabbitMQ } = require('./utils/rabbitmq');

const restaurantRoutes = require('./routes/restaurant.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(cors({ origin: '*' }));
app.use(
  morgan('dev', {
    skip: (req) => req.path === '/health',
  }),
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/restaurants', restaurantRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (!err) return next();
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ message });
});

async function bootstrap() {
  try {
    await connectRabbitMQ();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[product-service] rabbitmq connection failed:', error.message);
  }

  const port = config.port || 3002;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[product-service] listening on port ${port}`);
  });
}

bootstrap();
