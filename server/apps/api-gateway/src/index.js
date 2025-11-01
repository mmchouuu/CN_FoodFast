// api-gateway/src/index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config');

const requestId = require('./middlewares/requestId');
const errorHandler = require('./middlewares/errorHandler');
const health = require('./health');

const customersRoutes = require('./routes/customers.routes');
const restaurantsRoutes = require('./routes/restaurants.routes');
const adminRoutes = require('./routes/admin.routes');
const customerOrderRoutes = require('./routes/orders.customer.routes');
const ownerOrderRoutes = require('./routes/orders.owner.routes');
const adminOrderRoutes = require('./routes/orders.admin.routes');

const app = express();
app.use(bodyParser.json({ limit: '25mb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-request-id',
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
app.use(requestId);

app.use('/api/customers', customersRoutes);
app.use('/api/customer', customersRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/customer/orders', customerOrderRoutes);
app.use('/owner/orders', ownerOrderRoutes);
app.use('/admin/orders', adminOrderRoutes);

app.get('/health', health);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API Gateway listening on port ${config.port}`);
});
