const { pool } = require('../db');

const HUB_STATS_QUERY = `
  SELECT h.id,
         h.name,
         h.address,
         h.location,
         h.created_at,
         COALESCE(active.active_count, 0)    AS active_drones,
         COALESCE(flying.flying_count, 0)    AS in_flight,
         COALESCE(done.completed_today, 0)   AS completed_today
  FROM drone_hubs h
  LEFT JOIN (
    SELECT hub_id, COUNT(*)::int AS active_count
    FROM drones
    WHERE status != 'offline'
    GROUP BY hub_id
  ) active ON active.hub_id = h.id
  LEFT JOIN (
    SELECT hub_id, COUNT(*)::int AS flying_count
    FROM drones
    WHERE status = 'flying'
    GROUP BY hub_id
  ) flying ON flying.hub_id = h.id
  LEFT JOIN (
    SELECT dr.hub_id, COUNT(*)::int AS completed_today
    FROM deliveries d
    JOIN drones dr ON dr.id = d.drone_id
    WHERE d.delivery_status = 'completed'
      AND d.delivered_at::date = CURRENT_DATE
    GROUP BY dr.hub_id
  ) done ON done.hub_id = h.id
`;

const mapHubRow = (row) => ({
  id: row.id,
  name: row.name,
  address: row.address || null,
  coverage: row.address || null,
  location: row.location,
  created_at: row.created_at,
  active: Number(row.active_drones) || 0,
  inFlight: Number(row.in_flight) || 0,
  completedToday: Number(row.completed_today) || 0,
});

async function getSystemSummary() {
  const [hubsRes, dronesRes, inFlightRes, maintenanceRes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM drone_hubs'),
    pool.query('SELECT COUNT(*)::int AS count FROM drones'),
    pool.query("SELECT COUNT(*)::int AS count FROM drones WHERE status = 'flying'"),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM drones WHERE status = 'maintenance' OR battery_level < 20",
    ),
  ]);

  return {
    totalHubs: hubsRes.rows[0]?.count || 0,
    totalDrones: dronesRes.rows[0]?.count || 0,
    inFlight: inFlightRes.rows[0]?.count || 0,
    needsMaintenance: maintenanceRes.rows[0]?.count || 0,
  };
}

async function listHubsWithStats() {
  const { rows } = await pool.query(`${HUB_STATS_QUERY} ORDER BY h.name`);
  return rows.map(mapHubRow);
}

async function getHubWithStats(hubId) {
  if (!hubId) {
    const err = new Error('hubId is required');
    err.status = 400;
    throw err;
  }
  const { rows } = await pool.query(`${HUB_STATS_QUERY} WHERE h.id = $1`, [hubId]);
  if (!rows.length) {
    const err = new Error('Drone hub not found');
    err.status = 404;
    throw err;
  }
  return mapHubRow(rows[0]);
}

async function getHubOverview(hubId) {
  const hub = await getHubWithStats(hubId);

  const [avgBatteryRes, avgFlightRes, pendingRes, maintenanceRes] = await Promise.all([
    pool.query(
      'SELECT COALESCE(AVG(battery_level)::numeric, 0) AS avg_battery FROM drones WHERE hub_id = $1',
      [hubId],
    ),
    pool.query(
      `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (d.delivered_at - d.pickup_at)) / 60.0), 0) AS avg_flight_minutes
       FROM deliveries d
       JOIN drones dr ON dr.id = d.drone_id
       WHERE d.delivery_status = 'completed'
         AND d.delivered_at::date = CURRENT_DATE
         AND d.pickup_at IS NOT NULL
         AND dr.hub_id = $1`,
      [hubId],
    ),
    // Pending assignments are tracked system-wide as deliveries waiting for drone assignment.
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM deliveries
       WHERE delivery_status = 'pending'
         AND drone_id IS NULL`,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM drones
       WHERE status = 'maintenance'
         AND hub_id = $1`,
      [hubId],
    ),
  ]);

  return {
    hub: {
      id: hub.id,
      name: hub.name,
      coverage: hub.coverage,
      address: hub.address,
      location: hub.location,
    },
    overview: {
      coverage: hub.coverage,
      active: hub.active,
      inFlight: hub.inFlight,
      completedToday: hub.completedToday,
    },
    performance: {
      avgBatteryLevel: Number(avgBatteryRes.rows[0]?.avg_battery ?? 0),
      avgFlightTimeMinutes: Number(avgFlightRes.rows[0]?.avg_flight_minutes ?? 0),
      pendingAssignments: pendingRes.rows[0]?.count || 0,
      maintenanceCount: maintenanceRes.rows[0]?.count || 0,
    },
  };
}

module.exports = {
  getSystemSummary,
  listHubsWithStats,
  getHubOverview,
};
