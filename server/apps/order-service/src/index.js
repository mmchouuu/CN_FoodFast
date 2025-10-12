// require('dotenv').config();
// const express = require('express');
// const morgan = require('morgan');
// const orderRoutes = require('./routes/order.routes');
// const config = require('./config');

// const app = express();
// app.use(express.json());
// app.use(morgan('dev'));

// app.use('/api/orders', orderRoutes);
// app.get('/health', (req,res)=>res.json({ok:true, service:'order-service'}));

// const port = config.PORT || 3003;
// app.listen(port, ()=>console.log(`order-service listening ${port}`));
