// require('dotenv').config();
// const express = require('express');
// const morgan = require('morgan');
// const productRoutes = require('./routes/product.routes');
// const config = require('./config');

// const app = express();
// app.use(express.json());
// app.use(morgan('dev'));

// app.use('/api/products', productRoutes);
// app.get('/health', (req,res)=>res.json({ok:true, service:'product-service'}));

// const port = config.PORT || 3002;
// app.listen(port, ()=>console.log(`product-service listening ${port}`));


// import express from 'express';
// import dotenv from 'dotenv';
// import productRoutes from './routes/product.routes.js';

// dotenv.config();

// const app = express();
// app.use(express.json());

// app.get('/health', (_, res) => res.send('OK'));
// app.use('/api/products', productRoutes);

// const PORT = process.env.PORT || 3002;
// app.listen(PORT, () => {
//   console.log(`Product Service running on port ${PORT}`);
// });
