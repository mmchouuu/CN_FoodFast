const { pool } = require('../db');
const { publishDroneUpdate } = require('../events/socketPublisher');
const geo = require('../utils/geo');
const logger = require('../logger');

const ACTIVE_STATUSES = [
  'idle',
  'assigned',
  'flying',
  'charging',
  'to_restaurant',
  'to_customer',
  'returning',
];
const VALID_STATUSES = [...ACTIVE_STATUSES, 'offline', 'maintenance', 'landed'];
const AVAILABLE_SUMMARY_STATUSES = ['idle', 'charging'];
const ETA_STATUSES = ['assigned', 'flying', 'arriving'];

const PICKUP_PROXIMITY_METERS = 25;
const DROPOFF_PROXIMITY_METERS = 25;
const HUB_PROXIMITY_METERS = 40;
const RETURN_IDLE_BATTERY_THRESHOLD = 40;
const AVERAGE_SPEED_MPS = 30;
const BATTERY_DRAIN_MIN_PERCENT_PER_KM = 3;
const BATTERY_DRAIN_MAX_PERCENT_PER_KM = 5;

const sumPathMeters = (coords = []) => {
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = geo.haversineDistanceMeters(a, b);
    if (Number.isFinite(d)) total += d;
  }
  return total;
};

const toPathCoords = (coordinates) => {
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((coord) => {
      if (!coord) return null;
      if (Array.isArray(coord) && coord.length >= 2) {
        const lng = Number(coord[0]);
        const lat = Number(coord[1]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }
      if (typeof coord === 'object') {
        const lat = Number(coord.lat ?? coord.latitude);
        const lng = Number(coord.lng ?? coord.lon ?? coord.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }
      return null;
    })
    .filter(Boolean);
};

const nearestPathIndex = (path = [], point) => {
  if (!point || !path.length) return { index: 0, distance: null };
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  path.forEach((coord, idx) => {
    const d = geo.haversineDistanceMeters(coord, point);
    if (d !== null && d < bestDistance) {
      bestDistance = d;
      bestIndex = idx;
    }
  });
  return { index: bestIndex, distance: Number.isFinite(bestDistance) ? bestDistance : null };
};

const remainingOnPath = (path = [], point) => {
  if (!path.length) return { total: null, remaining: null };
  const total = sumPathMeters(path);
  if (!point || !Number.isFinite(total)) return { total, remaining: total };
  const { index } = nearestPathIndex(path, point);
  let progressed = 0;
  for (let i = 1; i <= index && i < path.length; i += 1) {
    const segment = geo.haversineDistanceMeters(path[i - 1], path[i]);
    if (Number.isFinite(segment)) {
      progressed += segment;
    }
  }
  const remaining = Math.max(0, total - progressed);
  return { total, remaining };
};

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampBatteryLevel = (value) => {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  if (parsed >= 100) return 100;
  if (parsed <= 0) return 0;
  return Math.round(parsed);
};

const toCoordinate = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value.location) {
    const nested = geo.normaliseCoordinate(value.location);
    if (nested) return nested;
  }
  return geo.normaliseCoordinate(value);
};

const metersBetween = (a, b) => {
  if (!a || !b) return null;
  return geo.haversineDistanceMeters(a, b);
};

const safeDivide = (value, total) => {
  if (!value || !total) return 0;
  const ratio = value / total;
  if (!Number.isFinite(ratio) || ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
};

const estimateEtaSeconds = (remainingMeters) => {
  if (!remainingMeters || remainingMeters <= 0) return null;
  return Math.max(1, Math.round(remainingMeters / AVERAGE_SPEED_MPS));
};

const normalizeTelemetryPayload = (payload = {}) => {
  const base = payload || {};
  const positionSource =
    base.position && typeof base.position === 'object' ? base.position : base;

  const lat = parseNumber(
    positionSource.lat ??
      positionSource.latitude ??
      base.lat ??
      base.latitude,
  );
  const lng = parseNumber(
    positionSource.lng ??
      positionSource.lon ??
      positionSource.long ??
      positionSource.longitude ??
      base.lng ??
      base.lon ??
      base.long ??
      base.longitude,
  );

  let position = null;
  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    position = { lat, lng };
  }

  const altitude = parseNumber(
    positionSource.alt ?? positionSource.altitude ?? base.alt ?? base.altitude,
  );
  if (position && altitude !== null) {
    position.alt = altitude;
  }

  const speed = parseNumber(
    positionSource.speed ??
      positionSource.velocity ??
      base.speed ??
      base.velocity,
  );
  if (position && speed !== null) {
    position.speed = speed;
  }

  const heading = parseNumber(
    positionSource.heading ?? base.heading ?? base.direction,
  );
  if (position && heading !== null) {
    position.heading = heading;
  }

  const deliveryIdRaw = base.delivery_id ?? base.deliveryId ?? null;
  const deliveryId =
    typeof deliveryIdRaw === 'string' ? deliveryIdRaw.trim() || null : deliveryIdRaw || null;

  return {
    position,
    speed,
    heading,
    batteryLevel: clampBatteryLevel(base.battery_level ?? base.batteryLevel ?? base.battery),
    status: typeof base.status === 'string' ? base.status.toLowerCase().trim() : null,
    deliveryId,
  };
};

const mapDroneRow = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    model: row.model,
    max_payload: parseNumber(row.max_payload),
    battery_level: parseNumber(row.battery_level),
    status: row.status,
    branch_id: row.branch_id, // backwards compatibility
    hub_id: row.hub_id,
    hub_name: row.hub_name || row.name || null,
    image_url: row.image_url || null,
    flights_today: parseNumber(row.flights_today) || 0,
    active_deliveries: parseNumber(row.active_deliveries) || 0,
    last_known_position: row.last_known_position || null,
    last_active_at: row.last_active_at,
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
    `SELECT id, drone_id, delivery_id, lat, lng, battery AS battery_level, speed, heading, status, created_at
     FROM drone_tracking_logs
     WHERE drone_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [id],
  );

  return rows.map((row) => ({
    id: row.id,
    drone_id: row.drone_id,
    delivery_id: row.delivery_id,
    position: row.lat != null && row.lng != null ? { lat: Number(row.lat), lng: Number(row.lng) } : null,
    battery_level: parseNumber(row.battery_level),
    speed: parseNumber(row.speed),
    heading: parseNumber(row.heading),
    status: row.status,
    created_at: row.created_at,
  }));
}

async function ingestTelemetry(droneId, payload = {}) {
  if (!droneId) {
    const err = new Error('drone id is required');
    err.status = 400;
    throw err;
  }

  const normalized = normalizeTelemetryPayload(payload);
  if (!normalized.position) {
    const err = new Error('latitude and longitude are required');
    err.status = 400;
    throw err;
  }
  if (normalized.status && !VALID_STATUSES.includes(normalized.status)) {
    const err = new Error('Invalid drone status');
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  let resolvedDroneId = droneId;

  try {
    await client.query('BEGIN');

    let { rows: droneRows } = await client.query(
      'SELECT * FROM drones WHERE id = $1 FOR UPDATE',
      [resolvedDroneId],
    );
    if (!droneRows.length && resolvedDroneId) {
      const alt = await client.query('SELECT * FROM drones WHERE code = $1 FOR UPDATE', [
        resolvedDroneId,
      ]);
      if (alt.rows.length) {
        droneRows = alt.rows;
        resolvedDroneId = alt.rows[0].id;
      }
    }

    if (!droneRows.length) {
      const err = new Error('Drone not found');
      err.status = 404;
      throw err;
    }

    const droneRow = droneRows[0];
    let hubName = null;
    let hubLocation = null;
    if (droneRow.hub_id) {
      const { rows: hubRows } = await client.query(
        'SELECT name, location FROM drone_hubs WHERE id = $1',
        [droneRow.hub_id],
      );
      hubName = hubRows[0]?.name || null;
      hubLocation = hubRows[0]?.location || null;
    }

    let deliveryRow = null;
    if (normalized.deliveryId) {
      const { rows } = await client.query(
        `
          SELECT id, order_id, delivery_status, branch_location, delivery_address,
                 current_position, progress_percent, estimated_time_sec,
                 distance_meters, pickup_at, delivered_at
          FROM deliveries
          WHERE id = $1
          FOR UPDATE
        `,
        [normalized.deliveryId],
      );
      deliveryRow = rows[0] || null;
      if (!deliveryRow) {
        logger.warn(
          '[delivery-service] telemetry received for unknown delivery %s (drone %s)',
          normalized.deliveryId,
          droneId,
        );
      }
    }

    const hubCoordinate = toCoordinate(hubLocation);
    const branchCoordinate = deliveryRow ? toCoordinate(deliveryRow.branch_location) : null;
    const customerCoordinate = deliveryRow
      ? toCoordinate(
          deliveryRow.delivery_address?.location || deliveryRow.delivery_address,
        )
      : null;
    const lastKnownCoordinate = toCoordinate(droneRow.last_known_position);

    const deliveryRoute =
      deliveryRow && typeof deliveryRow.route === 'string'
        ? (() => {
            try {
              return JSON.parse(deliveryRow.route);
            } catch {
              return null;
            }
          })()
        : deliveryRow?.route || null;

    const hubToRestaurantLeg = Array.isArray(deliveryRoute?.legs)
      ? deliveryRoute.legs.find((leg) => leg?.label === 'hub_to_branch')
      : null;
    const restaurantToCustomerLeg = Array.isArray(deliveryRoute?.legs)
      ? deliveryRoute.legs.find((leg) => leg?.label === 'branch_to_customer')
      : null;

    const hubToRestaurantPath = hubToRestaurantLeg?.geometry
      ? toPathCoords(hubToRestaurantLeg.geometry.coordinates)
      : hubCoordinate && branchCoordinate
        ? [hubCoordinate, branchCoordinate]
        : [];
    const restaurantToCustomerPath = restaurantToCustomerLeg?.geometry
      ? toPathCoords(restaurantToCustomerLeg.geometry.coordinates)
      : branchCoordinate && customerCoordinate
        ? [branchCoordinate, customerCoordinate]
        : [];

    const distanceToRestaurant = branchCoordinate
      ? metersBetween(normalized.position, branchCoordinate)
      : null;
    const distanceToCustomer = customerCoordinate
      ? metersBetween(normalized.position, customerCoordinate)
      : null;
    const distanceToHub = hubCoordinate
      ? metersBetween(normalized.position, hubCoordinate)
      : null;

    const hubToRestaurant = hubToRestaurantLeg?.distance_meters ?? sumPathMeters(hubToRestaurantPath);
    const restaurantToCustomer =
      restaurantToCustomerLeg?.distance_meters ?? sumPathMeters(restaurantToCustomerPath);
    const totalCourseDistance = (hubToRestaurant || 0) + (restaurantToCustomer || 0);

    const hubToRestaurantStats = remainingOnPath(hubToRestaurantPath, normalized.position);
    const customerStats = remainingOnPath(restaurantToCustomerPath, normalized.position);
    const returnPath = hubToRestaurantPath.length ? [...hubToRestaurantPath].reverse() : [];
    const returnStats = remainingOnPath(returnPath, normalized.position);

    let nextDeliveryStatus = (deliveryRow?.delivery_status || 'to_restaurant').toLowerCase();
    let deliveryStage = deliveryRow ? nextDeliveryStatus : 'idle';
    let progressPercent = deliveryRow ? deliveryRow.progress_percent ?? 0 : null;
    let etaSeconds = null;
    let shouldMarkDelivered = false;

    if (deliveryRow) {
      const reachedRestaurant =
        typeof distanceToRestaurant === 'number' &&
        distanceToRestaurant <= PICKUP_PROXIMITY_METERS;
      const leftRestaurant =
        typeof distanceToRestaurant === 'number' &&
        distanceToRestaurant > PICKUP_PROXIMITY_METERS * 1.6;
      const reachedCustomer =
        typeof distanceToCustomer === 'number' &&
        distanceToCustomer <= DROPOFF_PROXIMITY_METERS;

      if (reachedCustomer && nextDeliveryStatus !== 'returning' && nextDeliveryStatus !== 'completed') {
        nextDeliveryStatus = 'returning';
        shouldMarkDelivered = true;
        deliveryStage = 'returning';
        progressPercent = 100;
      } else if (reachedRestaurant && nextDeliveryStatus !== 'arriving') {
        nextDeliveryStatus = 'arriving';
        deliveryStage = 'arriving';
      } else if (nextDeliveryStatus === 'arriving' && leftRestaurant) {
        nextDeliveryStatus = 'to_customer';
        deliveryStage = 'to_customer';
      } else if (nextDeliveryStatus === 'arriving') {
        deliveryStage = 'arriving';
      } else if (nextDeliveryStatus === 'flying') {
        nextDeliveryStatus = 'to_customer';
        deliveryStage = reachedRestaurant ? 'to_customer' : 'to_restaurant';
      } else if (nextDeliveryStatus === 'assigned') {
        nextDeliveryStatus = 'to_restaurant';
        deliveryStage = 'to_restaurant';
      }

      if (!shouldMarkDelivered && totalCourseDistance > 0) {
        if (deliveryStage === 'to_restaurant') {
          const baseRatio = safeDivide(hubToRestaurant || hubToRestaurantStats.total || 0, totalCourseDistance);
          const travelled =
            hubToRestaurantStats.total && hubToRestaurantStats.remaining !== null
              ? safeDivide(
                  Math.max(hubToRestaurantStats.total - hubToRestaurantStats.remaining, 0),
                  hubToRestaurantStats.total,
                )
              : typeof distanceToRestaurant === 'number' && hubToRestaurant
                ? safeDivide(Math.max(hubToRestaurant - distanceToRestaurant, 0), hubToRestaurant)
                : 0;
          progressPercent = Math.round(Math.min(1, baseRatio * travelled) * 100);
        } else if (deliveryStage === 'arriving') {
          const baseRatio = safeDivide(hubToRestaurant || hubToRestaurantStats.total || 0, totalCourseDistance);
          progressPercent = Math.max(progressPercent || 0, Math.round(baseRatio * 100));
        } else if (deliveryStage === 'to_customer') {
          const baseRatio = safeDivide(hubToRestaurant || hubToRestaurantStats.total || 0, totalCourseDistance);
          const travelledAfterPickup =
            customerStats.total && customerStats.remaining !== null
              ? safeDivide(
                  Math.max(customerStats.total - customerStats.remaining, 0),
                  customerStats.total,
                )
              : typeof distanceToCustomer === 'number' && restaurantToCustomer
                ? safeDivide(Math.max(restaurantToCustomer - distanceToCustomer, 0), restaurantToCustomer)
                : 0;
          const completion = baseRatio + travelledAfterPickup * (1 - baseRatio);
          progressPercent = Math.round(Math.min(1, completion) * 100);
        }
      }

      if (deliveryStage === 'to_restaurant') {
        const remaining =
          (hubToRestaurantStats.remaining ?? distanceToRestaurant ?? 0) +
          (restaurantToCustomer || 0);
        etaSeconds = estimateEtaSeconds(remaining);
      } else if (deliveryStage === 'arriving') {
        const remaining = customerStats.remaining ?? restaurantToCustomer ?? 0;
        etaSeconds = estimateEtaSeconds(remaining);
      } else if (deliveryStage === 'to_customer') {
        etaSeconds = estimateEtaSeconds(
          customerStats.remaining ??
            (typeof distanceToCustomer === 'number' ? distanceToCustomer : restaurantToCustomer),
        );
      } else if (deliveryStage === 'returning') {
        etaSeconds = estimateEtaSeconds(returnStats.remaining ?? distanceToHub ?? 0);
      } else if (deliveryStage === 'delivered' || deliveryStage === 'landed') {
        etaSeconds = 0;
      }

      if (nextDeliveryStatus === 'returning' && distanceToHub !== null) {
        if (distanceToHub <= HUB_PROXIMITY_METERS) {
          nextDeliveryStatus = 'completed';
          deliveryStage = 'landed';
          etaSeconds = 0;
        } else if (deliveryStage !== 'returning') {
          deliveryStage = 'returning';
          etaSeconds = estimateEtaSeconds(distanceToHub);
        }
      }

      const deliveryUpdateFields = ['current_position = $1'];
      const deliveryUpdateValues = [normalized.position];

      deliveryRow.current_position = normalized.position;

      if (nextDeliveryStatus && nextDeliveryStatus !== deliveryRow.delivery_status) {
        deliveryUpdateValues.push(nextDeliveryStatus);
        deliveryUpdateFields.push(`delivery_status = $${deliveryUpdateValues.length}`);
        deliveryRow.delivery_status = nextDeliveryStatus;
      }

      if (progressPercent !== null && progressPercent !== deliveryRow.progress_percent) {
        deliveryUpdateValues.push(progressPercent);
        deliveryUpdateFields.push(`progress_percent = $${deliveryUpdateValues.length}`);
        deliveryRow.progress_percent = progressPercent;
      }

      if (etaSeconds !== null && deliveryRow.delivery_status !== 'completed') {
        deliveryUpdateValues.push(etaSeconds);
        deliveryUpdateFields.push(`estimated_time_sec = $${deliveryUpdateValues.length}`);
        deliveryRow.estimated_time_sec = etaSeconds;
      }

      if (shouldMarkDelivered && deliveryRow.delivery_status !== 'returning') {
        const deliveredAt = new Date();
        deliveryUpdateValues.push(deliveredAt);
        deliveryUpdateFields.push(`delivered_at = $${deliveryUpdateValues.length}`);
        deliveryRow.delivered_at = deliveredAt.toISOString();

        const totalMeters = Math.round(totalCourseDistance || 0);
        if (totalMeters > 0) {
          deliveryUpdateValues.push(totalMeters);
          deliveryUpdateFields.push(`distance_meters = $${deliveryUpdateValues.length}`);
          deliveryRow.distance_meters = totalMeters;
        }

        if (deliveryRow.pickup_at) {
          const pickupTs = new Date(deliveryRow.pickup_at).getTime();
          const elapsedSec = Math.max(1, Math.round((deliveredAt.getTime() - pickupTs) / 1000));
          deliveryUpdateValues.push(elapsedSec);
          deliveryUpdateFields.push(`estimated_time_sec = $${deliveryUpdateValues.length}`);
          deliveryRow.estimated_time_sec = elapsedSec;
        }

        deliveryRow.progress_percent = 100;
      }

      deliveryUpdateValues.push(deliveryRow.id);
      await client.query(
        `
          UPDATE deliveries
          SET ${deliveryUpdateFields.join(', ')}, updated_at = NOW()
          WHERE id = $${deliveryUpdateValues.length}
        `,
        deliveryUpdateValues,
      );
    }

    const deliveryCompleted = nextDeliveryStatus === 'completed';

    const stageStatusMap = {
      to_restaurant: 'to_restaurant',
      arriving: 'arriving',
      to_customer: 'to_customer',
      delivered: 'returning',
      returning: 'returning',
      landed: 'idle',
      idle: 'idle',
      completed: 'idle',
    };

    const forceReturning = shouldMarkDelivered && nextDeliveryStatus === 'returning';

    let nextDroneStatus = forceReturning
      ? 'returning'
      : normalized.status ||
        stageStatusMap[deliveryStage] ||
        stageStatusMap[nextDeliveryStatus] ||
        droneRow.status ||
        'idle';

    const droneUpdateFields = ['last_known_position = $1', 'last_active_at = NOW()', 'updated_at = NOW()'];
    const droneUpdateValues = [normalized.position];

    const previousBattery = parseNumber(droneRow.battery_level);
    const distanceSinceLast = lastKnownCoordinate && normalized.position
      ? metersBetween(lastKnownCoordinate, normalized.position) || 0
      : 0;

    let recordedBattery = null;

    if (normalized.batteryLevel !== null) {
      recordedBattery = clampBatteryLevel(normalized.batteryLevel);
      if (recordedBattery !== null) {
        droneUpdateFields.push(`battery_level = $${droneUpdateValues.length + 1}`);
        droneUpdateValues.push(recordedBattery);
      }
    } else if (previousBattery !== null) {
      let computedBattery = previousBattery;
      if (distanceSinceLast > 0) {
        const distanceKm = distanceSinceLast / 1000;
        const rate = BATTERY_DRAIN_MIN_PERCENT_PER_KM +
          Math.random() * (BATTERY_DRAIN_MAX_PERCENT_PER_KM - BATTERY_DRAIN_MIN_PERCENT_PER_KM);
        computedBattery = clampBatteryLevel(previousBattery - distanceKm * rate);
      }
      recordedBattery = computedBattery;
      if (computedBattery !== null && computedBattery !== previousBattery) {
        droneUpdateFields.push(`battery_level = $${droneUpdateValues.length + 1}`);
        droneUpdateValues.push(computedBattery);
      }
    } else {
      recordedBattery = previousBattery;
    }

    if (
      deliveryCompleted &&
      distanceToHub !== null &&
      distanceToHub <= HUB_PROXIMITY_METERS
    ) {
      const batteryForReset = recordedBattery ?? parseNumber(droneRow.battery_level) ?? 0;
      nextDroneStatus =
        batteryForReset >= RETURN_IDLE_BATTERY_THRESHOLD ? 'idle' : 'charging';
      deliveryStage = 'landed';
    }

    if (!VALID_STATUSES.includes(nextDroneStatus)) {
      nextDroneStatus = 'flying';
    }

    droneUpdateFields.push(`status = $${droneUpdateValues.length + 1}`);
    droneUpdateValues.push(nextDroneStatus);
    droneUpdateValues.push(resolvedDroneId);

    const { rows: updatedDroneRows } = await client.query(
      `
        UPDATE drones
        SET ${droneUpdateFields.join(', ')}
        WHERE id = $${droneUpdateValues.length}
        RETURNING *
      `,
      droneUpdateValues,
    );

    await client.query(
      `
        INSERT INTO drone_tracking_logs
          (drone_id, delivery_id, lat, lng, battery, speed, heading, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        resolvedDroneId,
        normalized.deliveryId,
        normalized.position.lat,
        normalized.position.lng,
        recordedBattery,
        normalized.speed,
        normalized.heading,
        nextDroneStatus,
      ],
    );

    await client.query('COMMIT');

    const mappedDrone = mapDroneRow({
      ...updatedDroneRows[0],
      hub_name: hubName,
      hub_location: hubLocation,
    });
    publishDroneUpdate({
      droneId: mappedDrone.id,
      code: mappedDrone.code,
      hubId: mappedDrone.hub_id,
      hubName: mappedDrone.hub_name,
      position: normalized.position,
      batteryLevel: recordedBattery,
      status: nextDroneStatus,
      speed: normalized.speed,
      heading: normalized.heading,
      deliveryId: deliveryRow?.id || normalized.deliveryId || null,
      orderId: deliveryRow?.order_id || null,
      deliveryStatus: deliveryRow?.delivery_status || nextDeliveryStatus || null,
      progressPercent: progressPercent ?? deliveryRow?.progress_percent ?? null,
      etaSeconds: etaSeconds ?? deliveryRow?.estimated_time_sec ?? null,
      stage: deliveryStage,
      recordedAt: new Date().toISOString(),
    });

    return mappedDrone;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getSummary,
  listDrones,
  createDrone,
  updateDrone,
  deleteDrone,
  getDroneLogs,
  ingestTelemetry,
};
