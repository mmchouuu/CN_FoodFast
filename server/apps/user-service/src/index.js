require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const config = require('./config');

// Routes
const customerRoutes = require('./routes/customer.routes');
const customerAddressRoutes = require('./routes/customer.address.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');

// RabbitMQ
const { connectRabbitMQ } = require('./utils/rabbitmq');

// Khởi tạo app
const app = express();

// Kết nối RabbitMQ
(async () => {
  try {
    await connectRabbitMQ();
    console.log('✅ Connected to RabbitMQ');
  } catch (err) {
    console.error('❌ Failed to connect RabbitMQ:', err.message);
  }
})();

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(morgan('dev'));

// Health check
app.use((req, res, next) => {
  if (req.path === '/health') return res.status(200).send({ status: 'ok' });
  next();
});


// Routes
app.use('/api/users', userRoutes);
app.use('/api/customers/me/addresses', customerAddressRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/admin', adminRoutes);

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// Khởi động server
const PORT = config.PORT || process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 User service listening on port ${PORT}`);
});
