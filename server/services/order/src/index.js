require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');
const orderRoutes = require('./routes/orders');
// const testRoutes = require('./routes/test');  // <-- import route test


const app = express();
app.use(bodyParser.json());

// health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// routes
app.use('/orders', orderRoutes);
// app.use('/orders', testRoutes);  // <-- mount test route

const PORT = process.env.PORT || 4003;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Order DB connected');

    app.listen(PORT, '0.0.0.0', () =>
      console.log(`Order service running on port ${PORT}`)
    );
  } catch (err) {
    console.error('Failed to start Order Service:', err);
    process.exit(1);
  }
}

start();
