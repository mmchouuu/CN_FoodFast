// index.js
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { pathToFileURL } from 'url';
import { connectRabbitMQ } from './utils/rabbitmq.js';

import productRoutes from './routes/product.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';
import seedRoutes from './routes/seed.routes.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(morgan('dev'));
app.use(cors({ origin: '*' }));

// Routes
app.use('/api/products', productRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/catalog/restaurants', restaurantRoutes);
app.use('/api/seed', seedRoutes);
app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'product-service' })
);

const PORT = process.env.PORT || 3002;

export async function startProductService() {
  const server = app.listen(PORT, async () => {
    console.log(`Product Service running on port ${PORT}`);
    try {
      await connectRabbitMQ();
      console.log('onnected to RabbitMQ');
    } catch (error) {
      console.error('[product-service] Failed to connect RabbitMQ:', error.message);
    }
  });

  return server;
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === executedFile) {
  startProductService();
}
