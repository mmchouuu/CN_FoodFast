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
const usersRoutes = require('./routes/users.routes');

const app = express();
app.use(bodyParser.json());
app.use(requestId);

// public routes
app.use('/api/users', usersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/admin', adminRoutes);

// health
app.get('/health', health);

// default error handler (must be last)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`API Gateway listening on port ${config.port}`);
});
