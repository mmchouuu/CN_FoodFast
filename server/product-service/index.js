require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://product:productpass@localhost:5436/productdb'
});

app.get('/', (req, res) => res.send('Product Service is running'));

const PORT = 5001;
app.listen(PORT, () => console.log(`Product Service running on port ${PORT}`));

module.exports = { pool };