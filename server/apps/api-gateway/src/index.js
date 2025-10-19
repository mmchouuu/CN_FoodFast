// api-gateway/src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');

const requestId = require('./middlewares/requestId');
const errorHandler = require('./middlewares/errorHandler');
const health = require('./health');

const customersRoutes = require('./routes/customers.routes');
const customerAddressesRoutes = require('./routes/customer-addresses.routes');
const restaurantsRoutes = require('./routes/restaurants.routes');
const adminRoutes = require('./routes/admin.routes');
const usersRoutes = require('./routes/users.routes');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');
const paymentsRoutes = require('./routes/payments.routes');

const app = express();
app.use(bodyParser.json());
// Basic CORS for development and SPA usage
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-request-id'
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(requestId);

// public routes
app.use('/api/users', usersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/customer', customersRoutes);
app.use('/api/customer-addresses', customerAddressesRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);

// health
app.get('/health', health);

// default error handler (must be last)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API Gateway listening on port ${config.port}`);
});
