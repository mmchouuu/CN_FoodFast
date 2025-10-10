require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const paymentRoutes = require('./routes/payment.routes');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/payments', paymentRoutes);
app.get('/health', (req,res)=>res.json({ok:true, service:'payment-service'}));

const port = config.PORT || 3004;
app.listen(port, ()=>console.log(`payment-service listening ${port}`));
