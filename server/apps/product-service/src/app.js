const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const productRoutes = require('./routes/product.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const seedRoutes = require('./routes/seed.routes');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: '*' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'product-service' }));
app.use('/api/products', productRoutes);
app.use('/api/catalog/restaurants', restaurantRoutes);
app.use('/api/seed', seedRoutes);

module.exports = app;
