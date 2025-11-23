const { pool } = require('../db');

const AVAILABLE_STATUSES = ['idle', 'charging'];
const IN_FLIGHT_STATUS = 'flying';
const ACTIVE_DELIVERY_STATUSES = ['assigned', 'flying'];

async function getAssignmentMetrics() {
  const [availableRes, inFlightRes, avgEtaRes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM drones WHERE status = ANY($1)', [
      AVAILABLE_STATUSES,
    ]),
    pool.query('SELECT COUNT(*)::int AS count FROM drones WHERE status = $1', [IN_FLIGHT_STATUS]),
    pool.query(
      `SELECT AVG(estimated_time_sec)::numeric AS avg_eta
       FROM deliveries
       WHERE delivery_status = ANY($1)
         AND estimated_time_sec IS NOT NULL`,
      [ACTIVE_DELIVERY_STATUSES],
    ),
  ]);

  return {
    availableDrones: availableRes.rows[0]?.count || 0,
    inFlight: inFlightRes.rows[0]?.count || 0,
    avgEtaSeconds: avgEtaRes.rows[0]?.avg_eta
      ? Number(avgEtaRes.rows[0].avg_eta)
      : 0,
  };
}

module.exports = {
  getAssignmentMetrics,
};
