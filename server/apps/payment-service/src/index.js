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
const internalPaymentRoutes = require('./routes/payments.internal.routes');
const ownerPayoutRoutes = require('./routes/payments.owner.routes');
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

  const headerUserId =
    req.headers['x-user-id'] ||
    req.headers['x-userid'] ||
    req.headers['x-customer-id'] ||
    req.headers['x-owner-id'];
  const bodyUserId = req.body?.user_id || req.body?.userId;
  const queryUserId = req.query?.user_id || req.query?.userId;
  const hasExplicitUserContext = Boolean(headerUserId || bodyUserId || queryUserId);

  if ((req.headers.authorization || req.headers.Authorization) && !hasExplicitUserContext) {
    return auth(req, res, next);
  }

  const resolvedUserId = headerUserId || bodyUserId || queryUserId;
  if (queryUserId && !headerUserId && resolvedUserId) {
    req.headers['x-user-id'] = resolvedUserId;
  }

  if (resolvedUserId) {
    req.user = req.user || {};
    req.user.userId = resolvedUserId;
    req.user.id = req.user.id || resolvedUserId;
    return next();
  }

  return res.status(401).json({ error: 'missing user context' });
};

app.use('/internal/payments', internalPaymentRoutes);
app.use('/api/payments/webhook', webhookRoutes);
app.use('/api/payments', ensureUserContext, paymentRoutes);

app.use(
  '/customer/payment-methods',
  auth,
  requireRoles(['customer', 'user']),
  customerPaymentRoutes,
);
app.use('/admin', auth, requireRoles(['admin', 'superadmin']), adminPaymentRoutes);
app.use(
  '/owner/payouts',
  auth,
  requireRoles(['owner', 'restaurant', 'restaurant_owner']),
  ownerPayoutRoutes,
);

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
