require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const paymentRoutes = require('./routes/payment.routes');
const config = require('./config');
const auth = require('./middlewares/auth');

const app = express();
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/payments', auth, paymentRoutes);
app.get('/health', (req,res)=>res.json({ok:true, service:'payment-service'}));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[payment-service] unhandled error', err);
  const status = err.status || err.httpStatus || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message, details: err.data || null });
});

const port = config.PORT || 3004;
app.listen(port, ()=>console.log(`payment-service listening ${port}`));
