const { pool } = require('../db');

const ACTIVE_STATUSES = ['idle', 'assigned', 'flying', 'charging'];
const VALID_STATUSES = [...ACTIVE_STATUSES, 'offline'];

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
    branch_id: row.branch_id,
    flights_today: safeNumber(row.flights_today) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

async function getSummary({ branchId } = {}) {
  const hasBranch = Boolean(branchId);
  const activeQuery = hasBranch
    ? 'SELECT COUNT(*)::int AS count FROM drones WHERE status = ANY($1) AND branch_id = $2'
    : 'SELECT COUNT(*)::int AS count FROM drones WHERE status = ANY($1)';
  const activeParams = hasBranch ? [ACTIVE_STATUSES, branchId] : [ACTIVE_STATUSES];

  const inFlightQuery = hasBranch
    ? "SELECT COUNT(*)::int AS count FROM drones WHERE status = 'flying' AND branch_id = $1"
    : "SELECT COUNT(*)::int AS count FROM drones WHERE status = 'flying'";
  const inFlightParams = hasBranch ? [branchId] : [];

  const completedQuery = hasBranch
    ? `SELECT COUNT(*)::int AS count
       FROM deliveries
       WHERE delivery_status = 'completed'
         AND delivered_at::date = CURRENT_DATE
         AND branch_id = $1`
    : `SELECT COUNT(*)::int AS count
       FROM deliveries
       WHERE delivery_status = 'completed'
         AND delivered_at::date = CURRENT_DATE`;
  const completedParams = hasBranch ? [branchId] : [];

  const [activeRes, inFlightRes, completedRes] = await Promise.all([
    pool.query(activeQuery, activeParams),
    pool.query(inFlightQuery, inFlightParams),
    pool.query(completedQuery, completedParams),
  ]);

  return {
    active: activeRes.rows[0]?.count || 0,
    inFlight: inFlightRes.rows[0]?.count || 0,
    completedToday: completedRes.rows[0]?.count || 0,
  };
}

async function listDrones({ branchId } = {}) {
  const hasBranch = Boolean(branchId);
  const branchClause = hasBranch ? 'WHERE d.branch_id = $1' : '';
  const params = hasBranch ? [branchId] : [];
  const query = `
    SELECT d.*,
           COALESCE(ft.flights_today, 0) AS flights_today
    FROM drones d
    LEFT JOIN (
      SELECT drone_id, COUNT(*)::int AS flights_today
      FROM deliveries
      WHERE delivery_status = 'completed'
        AND delivered_at::date = CURRENT_DATE
        ${hasBranch ? 'AND branch_id = $1' : ''}
      GROUP BY drone_id
    ) ft ON ft.drone_id = d.id
    ${branchClause}
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
    branch_id: branchId,
    branchId: fallbackBranch,
  } = payload;

  if (!code || !model) {
    const err = new Error('code and model are required');
    err.status = 400;
    throw err;
  }

  const safeStatus = VALID_STATUSES.includes((status || '').toLowerCase())
    ? status.toLowerCase()
    : 'idle';

  const values = [
    code.trim(),
    model.trim(),
    maxPayload ?? fallbackPayload ?? null,
    batteryLevel ?? fallbackBattery ?? 100,
    safeStatus,
    branchId || fallbackBranch || null,
  ];

  const insertQuery = `
    INSERT INTO drones (code, model, max_payload, battery_level, status, branch_id)
    VALUES ($1,$2,$3,$4,$5,$6)
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
  assign('branch_id', payload.branch_id ?? payload.branchId);

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
