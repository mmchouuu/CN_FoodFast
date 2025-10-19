import dotenv from 'dotenv';
import { pathToFileURL } from 'url';
import app from './app.js';
import { connectRabbitMQ } from './utils/rabbitmq.js';

dotenv.config();

const PORT = process.env.PORT || 3002;

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


export async function startProductService() {
  const server = app.listen(PORT, async () => {
    console.log(`Product Service running on port ${PORT}`);
    try {
      await connectRabbitMQ();
    } catch (error) {
      console.error('[product-service] Failed to connect to RabbitMQ:', error.message);
    }
  });

  return server;
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === executedFile) {
  startProductService();
}
