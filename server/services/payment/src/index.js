require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');
const paymentRoutes = require('./routes/payments');

const app = express();
app.use(bodyParser.json());

// health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

// routes
app.use('/payments', paymentRoutes);

const PORT = process.env.PORT || 4004;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Payment DB connected');

    app.listen(PORT, '0.0.0.0', () =>
      console.log(`Payment service running on port ${PORT}`)
    );
  } catch (err) {
    console.error('Failed to start Payment Service:', err);
    process.exit(1);
  }
}

start();
