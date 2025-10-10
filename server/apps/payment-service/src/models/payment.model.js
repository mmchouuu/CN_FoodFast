const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function createPayment({order_id, user_id, amount, currency='VND', payment_method_id=null, idempotency_key=null}){
  const res = await pool.query(
    `INSERT INTO payments (order_id, user_id, payment_method_id, idempotency_key, amount, currency, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
    [order_id, user_id, payment_method_id, idempotency_key, amount, currency]
  );
  return res.rows[0];
}

async function getPayment(id){
  const res = await pool.query('SELECT * FROM payments WHERE id=$1', [id]);
  return res.rows[0];
}

module.exports = { pool, createPayment, getPayment };
