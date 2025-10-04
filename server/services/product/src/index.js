require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');
const productRoutes = require('./routes/products');

const app = express();
app.use(bodyParser.json());

// health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service' });
});

// routes
app.use('/products', productRoutes);

const PORT = process.env.PORT || 4002;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Product DB connected');

    app.listen(PORT, '0.0.0.0', () =>
      console.log(`Product service running on port ${PORT}`)
    );
  } catch (err) {
    console.error('Failed to start Product Service:', err);
    process.exit(1);
  }
}

start();
