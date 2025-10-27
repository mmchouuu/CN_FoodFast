require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const roleRepository = require('./repositories/role.repository');

const customerRoutes = require('./routes/customer.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(express.json({ limit: '2mb' }));
// app.use(morgan('dev'));
app.use(
  morgan('dev', {
    skip: (req) => req.path === '/health',
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/customers', customerRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (!err) return next();
  const status = err.status || 500;
  const payload = {
    message: err.message || 'Internal Server Error',
  };
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json(payload);
});

async function bootstrap() {
  await roleRepository.ensureGlobalRoles();
  try {
    await connectRabbitMQ();
    // eslint-disable-next-line no-console
    console.log('Connected to RabbitMQ');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('RabbitMQ connection failed:', error.message);
  }

  const port = config.PORT || 3001;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`User service listening on port ${port}`);
  });
}

bootstrap();
