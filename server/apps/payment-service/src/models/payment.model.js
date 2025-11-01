const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function createPayment(
  {
    order_id,
    user_id,
    restaurant_id = null,
    branch_id = null,
    amount,
    currency = 'VND',
    payment_method_id = null,
    idempotency_key = null,
    status = 'pending',
    transaction_id = null,
    flow = 'online',
    paid_at = null,
  },
  client = null,
) {
  const runner = client || pool;
  const res = await runner.query(
    `INSERT INTO payments (
        order_id,
        user_id,
        restaurant_id,
        branch_id,
        payment_method_id,
        idempotency_key,
        amount,
        currency,
        status,
        transaction_id,
        flow,
        paid_at
      )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      order_id,
      user_id,
      restaurant_id,
      branch_id,
      payment_method_id,
      idempotency_key,
      amount,
      currency,
      status,
      transaction_id,
      flow,
      paid_at,
    ],
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

async function updatePayment(id, updates = {}, client = null) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  }

  if (!fields.length) return getPayment(id);

  values.push(id);
  const runner = client || pool;
  const res = await runner.query(
    `UPDATE payments
        SET ${fields.join(', ')},
            updated_at = now()
      WHERE id = $${values.length}
      RETURNING *`,
    values,
  );
  return res.rows[0];
}

async function insertPaymentLog({ paymentId, action, data }, client = null) {
  const runner = client || pool;
  await runner.query(
    `INSERT INTO payment_logs (payment_id, action, data)
     VALUES ($1,$2,$3)`,
    [paymentId, action, data ? JSON.stringify(data) : null],
  );
}

async function listPayments({
  status,
  flow,
  restaurantId,
  userId,
  limit = 20,
  offset = 0,
  startDate,
  endDate,
} = {}) {
  const params = [];
  let where = 'WHERE 1=1';

  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }

  if (flow) {
    params.push(flow);
    where += ` AND flow = $${params.length}`;
  }

  if (restaurantId) {
    params.push(restaurantId);
    where += ` AND restaurant_id = $${params.length}`;
  }

  if (userId) {
    params.push(userId);
    where += ` AND user_id = $${params.length}`;
  }

  if (startDate) {
    params.push(new Date(startDate));
    where += ` AND created_at >= $${params.length}`;
  }

  if (endDate) {
    params.push(new Date(endDate));
    where += ` AND created_at <= $${params.length}`;
  }

  const dataRes = await pool.query(
    `
      SELECT *
      FROM payments
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    params,
  );

  const totalRes = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM payments
      ${where}
    `,
    params,
  );

  return {
    rows: dataRes.rows,
    total: Number(totalRes.rows[0]?.total || 0),
  };
}

async function listRefunds({
  status,
  restaurantId,
  paymentId,
  limit = 20,
  offset = 0,
  startDate,
  endDate,
} = {}) {
  const params = [];
  let where = 'WHERE 1=1';

  if (status) {
    params.push(status);
    where += ` AND r.status = $${params.length}`;
  }

  if (paymentId) {
    params.push(paymentId);
    where += ` AND r.payment_id = $${params.length}`;
  }

  if (restaurantId) {
    params.push(restaurantId);
    where += ` AND p.restaurant_id = $${params.length}`;
  }

  if (startDate) {
    params.push(new Date(startDate));
    where += ` AND r.created_at >= $${params.length}`;
  }

  if (endDate) {
    params.push(new Date(endDate));
    where += ` AND r.created_at <= $${params.length}`;
  }

  const dataRes = await pool.query(
    `
      SELECT r.*, p.restaurant_id, p.user_id
      FROM refunds r
      LEFT JOIN payments p ON p.id = r.payment_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    params,
  );

  const totalRes = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM refunds r
      LEFT JOIN payments p ON p.id = r.payment_id
      ${where}
    `,
    params,
  );

  return {
    rows: dataRes.rows,
    total: Number(totalRes.rows[0]?.total || 0),
  };
}

module.exports = {
  pool,
  createPayment,
  getPayment,
  findPaymentByIdempotencyKey,
  getPaymentForUser,
  updatePayment,
  insertPaymentLog,
  listPayments,
  listRefunds,
};
