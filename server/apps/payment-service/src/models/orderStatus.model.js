const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.ORDER_DB);

const normaliseUuid = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

module.exports = {
  markOrderPaymentPaid,
};
