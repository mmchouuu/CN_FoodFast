require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:userpass@localhost:5435/userdb'
});

// Test route
app.get('/', (req, res) => {
  res.send('User Service is running');
});

const PORT = 5000;
app.listen(PORT, () => console.log(`User Service running on port ${PORT}`));

module.exports = { pool };