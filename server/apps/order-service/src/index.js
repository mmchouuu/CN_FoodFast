<<<<<<< HEAD
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const orderRoutes = require('./routes/order.routes');
const config = require('./config');
const auth = require('./middlewares/auth');
=======
// require('dotenv').config();
// const express = require('express');
// const morgan = require('morgan');
// const orderRoutes = require('./routes/order.routes');
// const config = require('./config');
>>>>>>> origin/mchau

// const app = express();
// app.use(express.json());
// app.use(morgan('dev'));

<<<<<<< HEAD
app.use('/api/orders', auth, orderRoutes);
app.get('/health', (req,res)=>res.json({ok:true, service:'order-service'}));

// basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[order-service] unhandled error', err);
  const status = err.status || err.httpStatus || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

const port = config.PORT || 3003;
app.listen(port, ()=>console.log(`order-service listening ${port}`));
=======
// app.use('/api/orders', orderRoutes);
// app.get('/health', (req,res)=>res.json({ok:true, service:'order-service'}));

// const port = config.PORT || 3003;
// app.listen(port, ()=>console.log(`order-service listening ${port}`));
>>>>>>> origin/mchau
