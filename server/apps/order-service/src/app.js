const express = require('express');
const morgan = require('morgan');

const ordersRouter = require('./routes/order.routes');
const customerOrderRoutes = require('./routes/orders.customer.routes');
const ownerOrderRoutes = require('./routes/orders.owner.routes');
const adminOrderRoutes = require('./routes/orders.admin.routes');
const auth = require('./middleware/auth');
const requireRoles = require('./middleware/authorize');

const app = express();

// Allow larger carts/options payloads to pass through without 413
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'order-service' });
});

app.use('/api/orders', ordersRouter);

// Support both legacy `/api/...` and simplified `/...` prefixes
const mountScopedRoute = (path, middleware, handler) => {
  app.use(path, auth, middleware, handler);
  app.use(`/api${path}`, auth, middleware, handler);
};

mountScopedRoute('/customer/orders', requireRoles(['customer', 'user']), customerOrderRoutes);
mountScopedRoute('/owner/orders', requireRoles(['owner', 'manager']), ownerOrderRoutes);
mountScopedRoute(
  '/admin/orders',
  requireRoles(['admin', 'superadmin', 'drone_operator']),
  adminOrderRoutes,
);

module.exports = app;
