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
const paymentMethodController = require('./controllers/paymentMethod.controller'); // 🟢 thêm dòng này
const config = require('./config');
const auth = require('./middlewares/auth');

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

// 🟢 Giữ nguyên route chính
app.use('/api/payments', ensureUserContext, paymentRoutes);

// 🟢 Thêm route payment-methods riêng
app.get(
  '/api/payment-methods/bank-accounts',
  ensureUserContext,
  paymentMethodController.listBankAccounts
);

app.post(
  '/api/payment-methods/bank-accounts',
  ensureUserContext,
  paymentMethodController.createBankAccount
);

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'payment-service' })
);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[payment-service] unhandled error', err);
  const status = err.status || err.httpStatus || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message, details: err.data || null });
});

const port = config.PORT || 3004;
app.listen(port, () => console.log(`payment-service listening ${port}`));
