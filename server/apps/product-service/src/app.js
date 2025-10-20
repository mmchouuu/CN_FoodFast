// import express from 'express';
// import productRoutes from './routes/product.routes.js';
// import restaurantRoutes from './routes/restaurant.routes.js';

// const app = express();
// app.use(express.json({ limit: '25mb' }));

// app.get('/health', (_, res) => res.send('OK'));
// app.use('/api/products', productRoutes);
// app.use('/api/restaurants', restaurantRoutes);
// app.use('/api/catalog/restaurants', restaurantRoutes);

// export default app;

import express from 'express';
import productRoutes from './routes/product.routes.js';
import restaurantRoutes from './routes/restaurant.routes.js';

const app = express();

// Parse JSON body với giới hạn lớn
app.use(express.json({ limit: '25mb' }));
// Parse form-urlencoded (nếu frontend gửi kiểu này)
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Log request và detect aborted
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - incoming request`);
  req.on('aborted', () => {
    console.log(`${req.method} ${req.url} - request aborted`);
  });
  next();
});

// Health check
app.get('/health', (_, res) => res.send('OK'));

// Routes
app.use('/api/products', productRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/catalog/restaurants', restaurantRoutes);

export default app;
