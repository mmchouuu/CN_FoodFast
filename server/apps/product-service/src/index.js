require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const productRoutes = require('./routes/product.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const seedRoutes = require('./routes/seed.routes');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(cors({ origin: '*'}));

app.use('/api/products', productRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/seed', seedRoutes);
app.get('/health', (req,res)=>res.json({ok:true, service:'product-service'}));

const port = config.PORT || 3002;
app.listen(port, ()=>console.log(`product-service listening ${port}`));
