const express = require('express');
const morgan = require('morgan');
const ordersRouter = require('./routes/order.routes');

const app = express();

// Allow larger carts/options payloads to pass through without 413
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'order-service' });
});

app.use('/api/orders', ordersRouter);

module.exports = app;
