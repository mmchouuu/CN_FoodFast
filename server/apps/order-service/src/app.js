const express = require('express');
const morgan = require('morgan');
const ordersRouter = require('./routes/orders.routes');
const auth = require('./middleware/auth');
const requireRoles = require('./middleware/authorize');
const customerOrderRoutes = require('./routes/orders.customer.routes');
const ownerOrderRoutes = require('./routes/orders.owner.routes');
const adminOrderRoutes = require('./routes/orders.admin.routes');

const app = express();

app.use(express.json({ limit: '2mb' }));
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
