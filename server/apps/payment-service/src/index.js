// require('dotenv').config();
// const express = require('express');
// const morgan = require('morgan');
// const paymentRoutes = require('./routes/payment.routes');
// const config = require('./config');
// const auth = require('./middlewares/auth');

// const app = express();
// app.use(express.json());
// app.use(morgan('dev'));

// const ensureUserContext = (req, res, next) => {
//   if (req.headers.authorization || req.headers.Authorization) {
//     return auth(req, res, next);
//   }

//   if (req.query?.user_id && !req.headers['x-user-id']) {
//     req.headers['x-user-id'] = req.query.user_id;
//   }

//   if (req.headers['x-user-id'] || req.body?.user_id) {
//     return next();
//   }

//   return res.status(401).json({ error: 'missing user context' });
// };

// app.use('/api/payments', ensureUserContext, paymentRoutes);
// app.get('/health', (req,res)=>res.json({ok:true, service:'payment-service'}));

// // eslint-disable-next-line no-unused-vars
// app.use((err, req, res, next) => {
//   console.error('[payment-service] unhandled error', err);
//   const status = err.status || err.httpStatus || 500;
//   const message = err.message || 'Internal server error';
//   res.status(status).json({ error: message, details: err.data || null });
// });

// const port = config.PORT || 3004;
// app.listen(port, ()=>console.log(`payment-service listening ${port}`));

require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const paymentRoutes = require('./routes/payment.routes');
const config = require('./config');
const auth = require('./middlewares/auth');
const requireRoles = require('./middlewares/authorize');
const customerPaymentRoutes = require('./routes/payments.customer.routes');
const adminPaymentRoutes = require('./routes/payments.admin.routes');
const { startOrderConsumer } = require('./consumers/order.consumer');

const app = express();
app.use(express.json());
app.use(morgan('dev'));


const ensureUserContext = (req, res, next) => {
  if (req.headers.authorization || req.headers.Authorization) {
    return auth(req, res, next);
  }

  if (req.query?.user_id && !req.headers['x-user-id']) {
    req.headers['x-user-id'] = req.query.user_id;
  }

  if (req.headers['x-user-id'] || req.body?.user_id) {
    return next();
  }

  return res.status(401).json({ error: 'missing user context' });
};

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

