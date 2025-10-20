const express = require('express');
const morgan = require('morgan');
const ordersRouter = require('./routes/orders.routes');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'order-service' });
});

app.use('/api/orders', ordersRouter);

module.exports = app;
