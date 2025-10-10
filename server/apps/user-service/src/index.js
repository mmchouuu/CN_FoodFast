require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const userRoutes = require('./routes/user.routes');

const app = express();

const { connectRabbitMQ } = require('./utils/rabbitmq');

// RabbitMQ
(async () => {
  await connectRabbitMQ(); 
})();

// Middleware
app.use(express.json()); 
app.use(morgan('dev'));

// Routes
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// Start server
const port = config.PORT || 3001;
app.listen(port, () => {
  console.log(`User service listening on port ${port}`);
});
