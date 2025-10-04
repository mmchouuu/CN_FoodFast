require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

const app = express();
app.use(bodyParser.json());

// health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

// routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

const PORT = process.env.PORT || 4001;

// async function start() {
//   try {
//     await sequelize.authenticate();
//     console.log('ser DB connected');

//     app.listen(PORT, '0.0.0.0', () =>
//       console.log(`User service running on port ${PORT}`)
//     );
//   } catch (err) {
//     console.error('Failed to start User Service:', err);
//     process.exit(1);
//   }
// }

async function start() {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
  } catch (err) {
    console.error('DB connection failed:', err);
  }

  app.listen(PORT, '0.0.0.0', () =>
    console.log(`User service running on port ${PORT}`)
  );
}


start();
