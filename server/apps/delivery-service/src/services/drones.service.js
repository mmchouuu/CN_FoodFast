const { pool } = require('../db');

const ACTIVE_STATUSES = ['idle', 'assigned', 'flying', 'charging'];
const VALID_STATUSES = [...ACTIVE_STATUSES, 'offline', 'maintenance'];
const AVAILABLE_SUMMARY_STATUSES = ['idle', 'charging'];
const ETA_STATUSES = ['assigned', 'flying'];

const mapDroneRow = (row) => {
  if (!row) return null;
  const safeNumber = (value) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    id: row.id,
    code: row.code,
    model: row.model,
    max_payload: safeNumber(row.max_payload),
    battery_level: safeNumber(row.battery_level),
    status: row.status,
    branch_id: row.branch_id, // backwards compatibility
    hub_id: row.hub_id,
    hub_name: row.hub_name || row.name || null,
    image_url: row.image_url || null,
    flights_today: safeNumber(row.flights_today) || 0,
    active_deliveries: safeNumber(row.active_deliveries) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

async function getSummary({ branchId, hubId } = {}) {
  const targetHub = hubId || branchId || null;
  const hasHubFilter = Boolean(targetHub);
  const activeQuery = hasHubFilter
    ? 'SELECT COUNT(*)::int AS count FROM drones WHERE status = ANY($1) AND hub_id = $2'
    : 'SELECT COUNT(*)::int AS count FROM drones WHERE status = ANY($1)';
  const activeParams = hasHubFilter ? [ACTIVE_STATUSES, targetHub] : [ACTIVE_STATUSES];

  const inFlightQuery = hasHubFilter
    ? "SELECT COUNT(*)::int AS count FROM drones WHERE status = 'flying' AND hub_id = $1"
    : "SELECT COUNT(*)::int AS count FROM drones WHERE status = 'flying'";
  const inFlightParams = hasHubFilter ? [targetHub] : [];

  const availableQuery = hasHubFilter
    ? 'SELECT COUNT(*)::int AS count FROM drones WHERE status = ANY($1) AND hub_id = $2'
    : 'SELECT COUNT(*)::int AS count FROM drones WHERE status = ANY($1)';
  const availableParams = hasHubFilter ? [AVAILABLE_SUMMARY_STATUSES, targetHub] : [AVAILABLE_SUMMARY_STATUSES];

  const completedQuery = hasHubFilter
    ? `SELECT COUNT(*)::int AS count
       FROM deliveries d
       JOIN drones dr ON dr.id = d.drone_id
       WHERE d.delivery_status = 'completed'
         AND d.delivered_at::date = CURRENT_DATE
         AND dr.hub_id = $1`
    : `SELECT COUNT(*)::int AS count
       FROM deliveries
       WHERE delivery_status = 'completed'
         AND delivered_at::date = CURRENT_DATE`;
  const completedParams = hasHubFilter ? [targetHub] : [];

  const avgEtaQuery = hasHubFilter
    ? `SELECT AVG(d.estimated_time_sec)::numeric AS avg_eta
       FROM deliveries d
       JOIN drones dr ON dr.id = d.drone_id
       WHERE d.delivery_status = ANY($1)
         AND d.estimated_time_sec IS NOT NULL
         AND dr.hub_id = $2`
    : `SELECT AVG(estimated_time_sec)::numeric AS avg_eta
       FROM deliveries
       WHERE delivery_status = ANY($1)
         AND estimated_time_sec IS NOT NULL`;
  const avgEtaParams = hasHubFilter ? [ETA_STATUSES, targetHub] : [ETA_STATUSES];

  const [activeRes, inFlightRes, completedRes, availableRes, avgEtaRes] = await Promise.all([
    pool.query(activeQuery, activeParams),
    pool.query(inFlightQuery, inFlightParams),
    pool.query(completedQuery, completedParams),
    pool.query(availableQuery, availableParams),
    pool.query(avgEtaQuery, avgEtaParams),
  ]);

  return {
    active: activeRes.rows[0]?.count || 0,
    available: availableRes.rows[0]?.count || 0,
    inFlight: inFlightRes.rows[0]?.count || 0,
    completedToday: completedRes.rows[0]?.count || 0,
    avgEtaSeconds: avgEtaRes.rows[0]?.avg_eta ? Number(avgEtaRes.rows[0].avg_eta) : 0,
  };
}

async function listDrones({ branchId, hubId, status } = {}) {
  const targetHub = hubId || branchId || null;
  const filters = [];
  const params = [];

  if (targetHub) {
    params.push(targetHub);
    filters.push(`d.hub_id = $${params.length}`);
  }

  const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : null;
  if (normalizedStatus === 'active') {
    filters.push(`d.status != 'offline'`);
  } else if (normalizedStatus === 'charging') {
    filters.push(`d.status = 'charging'`);
  } else if (normalizedStatus === 'maintenance') {
    filters.push(`d.status = 'maintenance'`);
  } else if (normalizedStatus && VALID_STATUSES.includes(normalizedStatus)) {
    params.push(normalizedStatus);
    filters.push(`d.status = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT d.*,
           h.name AS hub_name,
           COALESCE(ft.flights_today, 0) AS flights_today,
           COALESCE(ad.active_deliveries, 0) AS active_deliveries
    FROM drones d
    LEFT JOIN drone_hubs h ON h.id = d.hub_id
    LEFT JOIN (
      SELECT drone_id, COUNT(*)::int AS flights_today
      FROM deliveries
      WHERE delivery_status = 'completed'
        AND delivered_at::date = CURRENT_DATE
      GROUP BY drone_id
    ) ft ON ft.drone_id = d.id
    LEFT JOIN (
      SELECT drone_id, COUNT(*)::int AS active_deliveries
      FROM deliveries
      WHERE delivery_status IN ('assigned', 'flying')
      GROUP BY drone_id
    ) ad ON ad.drone_id = d.id
    ${whereClause}
    ORDER BY d.code NULLS LAST, d.created_at DESC
  `;

  const { rows } = await pool.query(query, params);
  return rows.map(mapDroneRow);
}

async function createDrone(payload = {}) {
  const {
    code,
    model,
    max_payload: maxPayload,
    maxPayload: fallbackPayload,
    battery_level: batteryLevel,
    batteryLevel: fallbackBattery,
    status,
    hub_id: hubId,
    hubId: fallbackHub,
    branch_id: legacyBranchId,
    branchId: legacyBranchIdAlt,
    image_url: imageUrl,
    imageUrl: fallbackImageUrl,
  } = payload;

  if (!code || !model) {
    const err = new Error('code and model are required');
    err.status = 400;
    throw err;
  }

  const safeStatus = VALID_STATUSES.includes((status || '').toLowerCase())
    ? status.toLowerCase()
    : 'idle';

  const resolvedHubId = hubId || fallbackHub || legacyBranchId || legacyBranchIdAlt || null;

  const values = [
    code.trim(),
    model.trim(),
    maxPayload ?? fallbackPayload ?? null,
    batteryLevel ?? fallbackBattery ?? 100,
    safeStatus,
    resolvedHubId,
    imageUrl || fallbackImageUrl || null,
  ];

  const insertQuery = `
    INSERT INTO drones (code, model, max_payload, battery_level, status, hub_id, image_url)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `;

  const { rows } = await pool.query(insertQuery, values);
  return mapDroneRow(rows[0]);
}

async function updateDrone(id, payload = {}) {
  if (!id) {
    const err = new Error('drone id is required');
    err.status = 400;
    throw err;
  }

  const fields = [];
  const values = [];
  let idx = 1;

  const assign = (column, value) => {
    if (value === undefined) return;
    fields.push(`${column} = $${idx}`);
    values.push(value);
    idx += 1;
  };

  assign('code', payload.code);
  assign('model', payload.model);
  assign('max_payload', payload.max_payload ?? payload.maxPayload);
  assign('battery_level', payload.battery_level ?? payload.batteryLevel);
  if (payload.status) {
    const normalized = payload.status.toLowerCase();
    if (VALID_STATUSES.includes(normalized)) {
      assign('status', normalized);
    }
  }
  const hubValue =
    payload.hub_id ?? payload.hubId ?? payload.branch_id ?? payload.branchId;
  if (hubValue !== undefined) {
    assign('hub_id', hubValue);
  }
  const imageValue = payload.image_url ?? payload.imageUrl;
  if (imageValue !== undefined) {
    assign('image_url', imageValue);
  }

  if (!fields.length) {
    const err = new Error('No fields provided for update');
    err.status = 400;
    throw err;
  }

  values.push(id);
  const updateQuery = `
    UPDATE drones
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${idx}
    RETURNING *
  `;

  const { rows } = await pool.query(updateQuery, values);
  if (!rows.length) {
    const err = new Error('Drone not found');
    err.status = 404;
    throw err;
  }
  return mapDroneRow(rows[0]);
}

async function deleteDrone(id) {
  if (!id) {
    const err = new Error('drone id is required');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    'DELETE FROM drones WHERE id = $1 RETURNING id',
    [id],
  );
  if (!rows.length) {
    const err = new Error('Drone not found');
    err.status = 404;
    throw err;
  }
  return { id: rows[0].id };
}

async function getDroneLogs(id) {
  if (!id) {
    const err = new Error('drone id is required');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT id, drone_id, delivery_id, position, battery_level, speed, created_at
     FROM drone_tracking_logs
     WHERE drone_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [id],
  );

  return rows;
}

module.exports = {
  getSummary,
  listDrones,
  createDrone,
  updateDrone,
  deleteDrone,
  getDroneLogs,
};
