require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://order:orderpass@localhost:5437/orderdb'
});

app.get('/', (req, res) => res.send('Order Service is running'));

const PORT = 5002;
app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));

module.exports = { pool };
