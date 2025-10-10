const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function createOrder({user_id, restaurant_id, branch_id, total_amount, currency='VND', metadata={}}){
  const res = await pool.query(
    `INSERT INTO orders (user_id, restaurant_id, branch_id, total_amount, currency, metadata)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [user_id, restaurant_id, branch_id, total_amount, currency, metadata]
  );
  return res.rows[0];
}

async function getOrder(id){
  const res = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  return res.rows[0];
}

module.exports = { pool, createOrder, getOrder };
