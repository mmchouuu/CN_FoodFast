require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const auth = require('./middlewares/auth');
const requireRoles = require('./middlewares/authorize');
const ordersRouter = require('./routes/order.routes');
const customerOrderRoutes = require('./routes/orders.customer.routes');
const ownerOrderRoutes = require('./routes/orders.owner.routes');
const adminOrderRoutes = require('./routes/orders.admin.routes');
const { startPaymentConsumer } = require('./consumers/payment.consumer');

const app = express();
// Keep JSON body limit aligned with API gateway to avoid 413 errors
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('dev'));

app.use('/api/orders', ordersRouter);

app.use('/customer/orders', auth, requireRoles(['customer', 'user']), customerOrderRoutes);
app.use('/owner/orders', auth, requireRoles(['owner_main', 'owner', 'manager', 'staff']), ownerOrderRoutes);
app.use(
  '/admin/orders',
  auth,
  requireRoles(['admin', 'superadmin', 'drone_operator']),
  adminOrderRoutes,
);
app.get('/health', (req, res) => res.json({ ok: true, service: 'order-service' }));

// basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[order-service] unhandled error', err);
  const status = err.status || err.httpStatus || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

const port = config.PORT || 3003;
app.listen(port, () => console.log(`order-service listening ${port}`));

startPaymentConsumer().catch((error) => {
  console.error('[order-service] Failed to start payment consumer:', error);
});
