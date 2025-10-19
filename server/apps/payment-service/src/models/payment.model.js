const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function createPayment(
  {
    order_id,
    user_id,
    amount,
    currency = 'VND',
    payment_method_id = null,
    idempotency_key = null,
    status = 'pending',
    transaction_id = null,
    paid_at = null,
  },
  client = null
) {
  const runner = client || pool;
  const res = await runner.query(
    `INSERT INTO payments (order_id, user_id, payment_method_id, idempotency_key, amount, currency, status, transaction_id, paid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      order_id,
      user_id,
      payment_method_id,
      idempotency_key,
      amount,
      currency,
      status,
      transaction_id,
      paid_at,
    ]
  );
  return res.rows[0];
}

async function getPayment(id){
  const res = await pool.query('SELECT * FROM payments WHERE id=$1', [id]);
  return res.rows[0];
}

async function findPaymentByIdempotencyKey(idempotencyKey, userId) {
  if (!idempotencyKey) return null;
  const res = await pool.query(
    `SELECT * FROM payments
     WHERE idempotency_key = $1 AND ($2::uuid IS NULL OR user_id = $2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [idempotencyKey, userId || null]
  );
  return res.rows[0] || null;
}

async function getPaymentForUser(id, userId) {
  const res = await pool.query(
    'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return res.rows[0] || null;
}

module.exports = {
  pool,
  createPayment,
  getPayment,
  findPaymentByIdempotencyKey,
  getPaymentForUser,
};
