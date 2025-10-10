const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function listProducts(limit=20, offset=0){
  const res = await pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  return res.rows;
}

async function getProductById(id){
  const res = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
  return res.rows[0];
}

module.exports = { pool, listProducts, getProductById };
