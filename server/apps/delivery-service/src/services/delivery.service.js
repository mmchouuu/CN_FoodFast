const db = require('../db');
const logger = require('../logger');

const parseLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 100);
};

const ACTIVE_STATUSES = ['pending', 'assigned', 'flying', 'arriving'];

const mapDeliveryRow = (row) => {
  if (!row) return null;
  const safeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    id: row.id,
    order_id: row.order_id,
    branch_id: row.branch_id,
    provider_type: row.provider_type,
    delivery_status: row.delivery_status,
    progress_percent: safeNumber(row.progress_percent) ?? 0,
    estimated_time_sec: safeNumber(row.estimated_time_sec),
    distance_meters: safeNumber(row.distance_meters),
    current_position: row.current_position,
    delivery_address: row.delivery_address,
    branch_location: row.branch_location,
    pickup_at: row.pickup_at,
    delivered_at: row.delivered_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    drone: row.drone_id
      ? {
          id: row.drone_id,
          code: row.drone_code,
          battery_level: safeNumber(row.drone_battery_level),
          status: row.drone_status,
          image_url: row.drone_image_url,
          hub: row.hub_id
            ? {
                id: row.hub_id,
                name: row.hub_name,
                location: row.hub_location,
              }
            : null,
        }
      : null,
  };
};

const normalizeStatusFilter = (statusRaw) => {
  if (!statusRaw || typeof statusRaw !== 'string') return null;
  const normalized = statusRaw.toLowerCase();
  if (normalized === 'active') return 'active';
  return normalized;
};

async function listDeliveries({ limit, status } = {}) {
  const safeLimit = parseLimit(limit);
  const normalizedStatus = normalizeStatusFilter(status);

  const filters = [];
  const params = [];

  if (normalizedStatus === 'active') {
    filters.push(`d.delivery_status NOT IN ('completed','failed','cancelled')`);
  } else if (normalizedStatus) {
    params.push(normalizedStatus);
    filters.push(`d.delivery_status = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const listQuery = `
    SELECT
      d.*,
      dr.code AS drone_code,
      dr.image_url AS drone_image_url,
      dr.battery_level AS drone_battery_level,
      dr.status AS drone_status,
      dr.hub_id,
      h.name AS hub_name,
      h.location AS hub_location
    FROM deliveries d
    LEFT JOIN drones dr ON dr.id = d.drone_id
    LEFT JOIN drone_hubs h ON h.id = dr.hub_id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT $${params.length + 1}
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM deliveries d
    ${whereClause}
  `;

  const metricsQuery = `
    SELECT
      SUM(CASE WHEN d.delivery_status NOT IN ('completed','failed','cancelled') THEN 1 ELSE 0 END)::int AS active_deliveries,
      SUM(CASE WHEN d.delivery_status IN ('failed','cancelled') THEN 1 ELSE 0 END)::int AS delayed_alerts,
      COALESCE(AVG(CASE WHEN d.delivery_status NOT IN ('completed','failed','cancelled')
                        THEN d.estimated_time_sec END), 0)::numeric AS avg_eta_sec
    FROM deliveries d
  `;

  params.push(safeLimit);

  const [listRes, countRes, metricsRes] = await Promise.all([
    db.query(listQuery, params),
    db.query(countQuery, filters.length ? params.slice(0, params.length - 1) : []),
    db.query(metricsQuery),
  ]);

  return {
    items: listRes.rows.map(mapDeliveryRow),
    limit: safeLimit,
    total: countRes.rows[0]?.total || 0,
    metrics: {
      activeDeliveries: metricsRes.rows[0]?.active_deliveries || 0,
      delayedAlerts: metricsRes.rows[0]?.delayed_alerts || 0,
      avgEtaSeconds: Number(metricsRes.rows[0]?.avg_eta_sec || 0),
    },
  };
}

async function getSystemStatus() {
  try {
    const timestamp = await db.healthCheck();
    return {
      database: 'ok',
      timestamp,
    };
  } catch (error) {
    logger.error('[delivery-service] Database health check failed:', error);
    return {
      database: 'error',
      error: error.message,
    };
  }
}

module.exports = {
  listDeliveries,
  getSystemStatus,
};
