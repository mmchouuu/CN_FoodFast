const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.ORDER_DB);

const normaliseUuid = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

async function markOrderPaymentPaid(orderId) {
  const resolvedId = normaliseUuid(orderId);
  if (!resolvedId) return null;

  const result = await pool.query(
    `
      UPDATE orders
      SET payment_status = 'paid',
          updated_at = now()
      WHERE id = $1
        AND payment_status <> 'paid'
      RETURNING id, payment_status
    `,
    [resolvedId],
  );
  return result.rows[0] || null;
}

async function fetchOrderSnapshot(orderId) {
  const resolvedId = normaliseUuid(orderId);
  if (!resolvedId) return null;

  const result = await pool.query(
    `
      SELECT
        id,
        restaurant_id,
        branch_id,
        status,
        payment_status,
        total_amount,
        tax_total,
        shipping_fee,
        currency,
        metadata,
        created_at,
        updated_at
      FROM orders
      WHERE id = $1
      LIMIT 1
    `,
    [resolvedId],
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  const metadata = parseJson(row.metadata) || row.metadata || null;
  return {
    ...row,
    metadata,
  };
}

module.exports = {
  markOrderPaymentPaid,
  fetchOrderSnapshot,
};
