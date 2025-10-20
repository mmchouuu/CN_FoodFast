import express from 'express';
import productRoutes from './routes/product.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';

const app = express();
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_, res) => res.send('OK'));
app.use('/api/products', productRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/catalog/restaurants', restaurantRoutes);

export default app;
