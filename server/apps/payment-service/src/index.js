// payment-service/src/index.js

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const paymentRoutes = require('./routes/payment.routes');
const webhookRoutes = require('./routes/webhook.routes');
const config = require('./config');
const auth = require('./middlewares/auth');
const requireRoles = require('./middlewares/authorize');
const customerPaymentRoutes = require('./routes/payments.customer.routes');
const adminPaymentRoutes = require('./routes/payments.admin.routes');
const { startOrderConsumer } = require('./consumers/order.consumer');

const app = express();
app.use(
  morgan('dev', {
    skip: (req) => req.path === '/health',
  }),
);
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      if (req.originalUrl?.startsWith('/api/payments/webhook/stripe')) {
        req.rawBody = Buffer.from(buf);
      }
    },
  }),
);

const ensureUserContext = (req, res, next) => {
  if (req.originalUrl?.startsWith('/api/payments/webhook')) {
    return next();
  }
  if (req.headers.authorization || req.headers.Authorization) {
    return auth(req, res, next);
  }

  if (req.query?.user_id && !req.headers['x-user-id']) {
    req.headers['x-user-id'] = req.query.user_id;
  }

  // Accept direct user context via header/body and normalize to req.user
  const headerUserId = req.headers['x-user-id'];
  const bodyUserId = req.body?.user_id;
  if (headerUserId || bodyUserId) {
    const userId = headerUserId || bodyUserId;
    req.user = req.user || { userId };
    return next();
  }

  return res.status(401).json({ error: 'missing user context' });
};

app.use('/api/payments/webhook', webhookRoutes);
app.use('/api/payments', ensureUserContext, paymentRoutes);

app.use(
  '/customer/payment-methods',
  auth,
  requireRoles(['customer', 'user']),
  customerPaymentRoutes,
);
app.use('/admin', auth, requireRoles(['admin', 'superadmin']), adminPaymentRoutes);

app.get('/health', (req, res) => res.json({ ok: true, service: 'payment-service' }));


// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[payment-service] unhandled error', err);
  const status = err.status || err.httpStatus || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message, details: err.data || null });
});

const port = config.PORT || 3004;
app.listen(port, () => console.log(`payment-service listening ${port}`));

startOrderConsumer().catch((error) => {
  console.error('[payment-service] Failed to start order consumer:', error);
});

