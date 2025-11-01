const { pool } = require('../models/payment.model');

const toDateOnly = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

async function runSettlementJob({ periodStart, periodEnd } = {}) {
  const start = toDateOnly(periodStart);
  const end = periodEnd ? toDateOnly(periodEnd) : new Date(start.getTime() + 86400000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const paymentsRes = await client.query(
      `
        SELECT restaurant_id,
               flow,
               SUM(amount) AS total_amount
          FROM payments
         WHERE status = 'succeeded'
           AND created_at >= $1
           AND created_at < $2
         GROUP BY restaurant_id, flow
      `,
      [start, end],
    );

    const refundsRes = await client.query(
      `
        SELECT p.restaurant_id,
               r.flow,
               SUM(r.amount) AS total_amount
          FROM refunds r
          JOIN payments p ON p.id = r.payment_id
         WHERE r.status = 'succeeded'
           AND r.created_at >= $1
           AND r.created_at < $2
         GROUP BY p.restaurant_id, r.flow
      `,
      [start, end],
    );

    const byRestaurant = new Map();

    paymentsRes.rows.forEach((row) => {
      if (!row.restaurant_id) return;
      const entry = byRestaurant.get(row.restaurant_id) || {
        restaurant_id: row.restaurant_id,
        online_gross: 0,
        cash_gross: 0,
        online_refunds: 0,
        cash_refunds: 0,
      };
      if (row.flow === 'cash') {
        entry.cash_gross += Number(row.total_amount || 0);
      } else {
        entry.online_gross += Number(row.total_amount || 0);
      }
      byRestaurant.set(row.restaurant_id, entry);
    });

    refundsRes.rows.forEach((row) => {
      if (!row.restaurant_id) return;
      const entry = byRestaurant.get(row.restaurant_id) || {
        restaurant_id: row.restaurant_id,
        online_gross: 0,
        cash_gross: 0,
        online_refunds: 0,
        cash_refunds: 0,
      };
      if (row.flow === 'cash') {
        entry.cash_refunds += Number(row.total_amount || 0);
      } else {
        entry.online_refunds += Number(row.total_amount || 0);
      }
      byRestaurant.set(row.restaurant_id, entry);
    });

    for (const [, summary] of byRestaurant.entries()) {
      const netOnline = summary.online_gross - summary.online_refunds;
      const netCash = summary.cash_gross - summary.cash_refunds;
      const netResult = netOnline - Math.max(0, netCash);

      const settlementRes = await client.query(
        `
          INSERT INTO restaurant_settlements (
            restaurant_id,
            period_start,
            period_end,
            online_gross,
            online_refunds,
            cash_gross,
            cash_refunds,
            net_result,
            status
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ready')
          ON CONFLICT (restaurant_id, period_start, period_end)
          DO UPDATE SET
            online_gross = EXCLUDED.online_gross,
            online_refunds = EXCLUDED.online_refunds,
            cash_gross = EXCLUDED.cash_gross,
            cash_refunds = EXCLUDED.cash_refunds,
            net_result = EXCLUDED.net_result,
            updated_at = now()
          RETURNING id
        `,
        [
          summary.restaurant_id,
          start,
          end,
          summary.online_gross,
          summary.online_refunds,
          summary.cash_gross,
          summary.cash_refunds,
          netResult,
        ],
      );

      const settlementId = settlementRes.rows[0]?.id;
      if (!settlementId) continue;

      await client.query(
        `DELETE FROM restaurant_settlement_items WHERE settlement_id = $1`,
        [settlementId],
      );

      if (summary.online_gross > 0) {
        await client.query(
          `
            INSERT INTO restaurant_settlement_items (
              settlement_id,
              item_type,
              amount,
              meta
            ) VALUES ($1,'payment',$2,$3)
          `,
          [settlementId, summary.online_gross, { flow: 'online' }],
        );
      }

      if (summary.online_refunds > 0) {
        await client.query(
          `
            INSERT INTO restaurant_settlement_items (
              settlement_id,
              item_type,
              amount,
              meta
            ) VALUES ($1,'refund',$2,$3)
          `,
          [settlementId, -summary.online_refunds, { flow: 'online' }],
        );
      }

      if (summary.cash_gross > 0) {
        await client.query(
          `
            INSERT INTO restaurant_settlement_items (
              settlement_id,
              item_type,
              amount,
              meta
            ) VALUES ($1,'cash_sale',$2,$3)
          `,
          [settlementId, summary.cash_gross, { flow: 'cash' }],
        );
      }

      if (summary.cash_refunds > 0) {
        await client.query(
          `
            INSERT INTO restaurant_settlement_items (
              settlement_id,
              item_type,
              amount,
              meta
            ) VALUES ($1,'cash_refund',$2,$3)
          `,
          [settlementId, -summary.cash_refunds, { flow: 'cash' }],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[payment-service] settlement job failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  runSettlementJob,
};
