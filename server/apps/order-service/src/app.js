const express = require('express');
const morgan = require('morgan');
// <<<<<<< HEAD
// const ordersRouter = require('./routes/orders.routes');
const auth = require('./middleware/auth');
const requireRoles = require('./middleware/authorize');
const customerOrderRoutes = require('./routes/orders.customer.routes');
const ownerOrderRoutes = require('./routes/orders.owner.routes');
const adminOrderRoutes = require('./routes/orders.admin.routes');

const ordersRouter = require('./routes/order.routes');

const app = express();

// Allow larger carts/options payloads to pass through without 413
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'order-service' });
});

app.use('/customer/orders', auth, requireRoles(['customer', 'user']), customerOrderRoutes);
app.use('/owner/orders', auth, requireRoles(['owner', 'manager']), ownerOrderRoutes);
app.use('/admin/orders', auth, requireRoles(['admin', 'superadmin']), adminOrderRoutes);

// Legacy routing compatibility (/api/orders/*)
app.use('/api/orders', ordersRouter);

module.exports = app;
