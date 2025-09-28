require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://payment:paymentpass@localhost:5438/paymentdb'
});

app.get('/', (req, res) => res.send('Payment Service is running'));

const PORT = 5003;
app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));

module.exports = { pool };
