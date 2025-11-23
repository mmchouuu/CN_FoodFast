const { pool } = require('../db');
const geo = require('../utils/geo');
const logger = require('../logger');

const normalizeUuid = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(
    trimmed,
  )
    ? trimmed
    : null;
};

async function deliveryExists(orderId) {
  const { rows } = await pool.query('SELECT id FROM deliveries WHERE order_id = $1 LIMIT 1', [
    orderId,
  ]);
  return rows.length > 0;
}

const roundOrNull = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;

async function buildRoute({ hubCoordinate, branchCoordinate, customerCoordinate }) {
  const legs = [];
  const waypoints = [];
  if (hubCoordinate) waypoints.push(hubCoordinate);
  if (branchCoordinate) waypoints.push(branchCoordinate);
  if (customerCoordinate) waypoints.push(customerCoordinate);

  let totalDistance = 0;
  let totalDuration = 0;
  const polylineSegments = [];

  const addLeg = async (from, to, label) => {
    if (!from || !to) return;
    const metrics = await geo.getRouteMetrics(from, to);
    const distance = metrics?.distanceMeters ?? geo.haversineDistanceMeters(from, to) ?? null;
    const duration = metrics?.durationSeconds ?? null;
    if (distance) {
      totalDistance += distance;
    }
    if (duration) {
      totalDuration += duration;
    }
    if (metrics?.geometry) {
      polylineSegments.push(metrics.geometry);
    }
    legs.push({
      label,
      distance_meters: distance,
      duration_seconds: duration,
    });
  };

  await addLeg(hubCoordinate, branchCoordinate, 'hub_to_branch');
  await addLeg(branchCoordinate, customerCoordinate, 'branch_to_customer');

  const routePayload = {
    waypoints,
    legs,
    total_distance_meters: totalDistance || null,
    total_duration_seconds: totalDuration || null,
  };
  if (polylineSegments.length) {
    routePayload.polyline = polylineSegments.join('|');
  }
  return routePayload;
}

async function createDeliveryRecord({
  orderId,
  branchId,
  hubCoordinate,
  branchCoordinate,
  customerCoordinate,
  shippingSnapshot,
}) {
  if (!orderId) return;
  if (await deliveryExists(orderId)) {
    return;
  }
  if (!branchCoordinate || !customerCoordinate) {
    logger.warn(
      `[delivery-service] Cannot create delivery for ${orderId} - missing branch or customer coordinate`,
    );
    return;
  }
  if (!shippingSnapshot) {
    logger.warn(
      `[delivery-service] Cannot create delivery for ${orderId} - missing shipping snapshot`,
    );
    return;
  }

  const route = await buildRoute({ hubCoordinate, branchCoordinate, customerCoordinate });
  const distanceMeters = route.total_distance_meters
    ? route.total_distance_meters
    : geo.haversineDistanceMeters(branchCoordinate, customerCoordinate);

  await pool.query(
    `
      INSERT INTO deliveries (
        order_id,
        branch_id,
        provider_type,
        drone_id,
        drone_snapshot,
        delivery_address,
        branch_location,
        route,
        distance_meters,
        estimated_time_sec,
        delivery_status
      )
      VALUES (
        $1,$2,'drone',NULL,NULL,$3,$4,$5,$6,$7,'pending'
      )
    `,
    [
      orderId,
      branchId || null,
      JSON.stringify(shippingSnapshot),
      JSON.stringify(branchCoordinate),
      JSON.stringify(route),
      roundOrNull(distanceMeters),
      roundOrNull(route.total_duration_seconds) || null,
    ],
  );

  logger.info(`[delivery-service] Created delivery record for order ${orderId}`);
}

async function getDeliveriesByOrderIds(orderIds = []) {
  const normalized = orderIds
    .map((value) => normalizeUuid(value))
    .filter((value, index, arr) => value && arr.indexOf(value) === index);
  if (!normalized.length) {
    return [];
  }
  const { rows } = await pool.query(
    `
      SELECT id,
             order_id,
             branch_id,
             provider_type,
             drone_id,
             drone_snapshot,
             delivery_address,
             branch_location,
             route,
             distance_meters,
             estimated_time_sec,
             delivery_status,
             created_at,
             updated_at
      FROM deliveries
      WHERE order_id = ANY($1::uuid[])
    `,
    [normalized],
  );
  return rows.map((row) => ({
    ...row,
    delivery_address:
      (typeof row.delivery_address === 'object'
        ? row.delivery_address
        : (() => {
            try {
              return JSON.parse(row.delivery_address);
            } catch {
              return null;
            }
          })()) || null,
    branch_location:
      (typeof row.branch_location === 'object'
        ? row.branch_location
        : (() => {
            try {
              return JSON.parse(row.branch_location);
            } catch {
              return null;
            }
          })()) || null,
    route:
      (typeof row.route === 'object'
        ? row.route
        : (() => {
            try {
              return JSON.parse(row.route);
            } catch {
              return null;
            }
          })()) || null,
    drone_snapshot:
      (typeof row.drone_snapshot === 'object'
        ? row.drone_snapshot
        : (() => {
            try {
              return JSON.parse(row.drone_snapshot);
            } catch {
              return null;
            }
          })()) || null,
  }));
}

async function assignDelivery({ deliveryId, orderId, droneId, assignedBy }) {
  const normalizedDeliveryId = deliveryId ? normalizeUuid(deliveryId) : null;
  const normalizedOrderId = orderId ? normalizeUuid(orderId) : null;
  const normalizedDroneId = normalizeUuid(droneId);

  if (!normalizedDeliveryId && !normalizedOrderId) {
    throw new Error('deliveryId or orderId is required');
  }
  if (!normalizedDroneId) {
    throw new Error('droneId is required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deliveryRes = normalizedDeliveryId
      ? await client.query(
          'SELECT * FROM deliveries WHERE id = $1 FOR UPDATE',
          [normalizedDeliveryId],
        )
      : await client.query('SELECT * FROM deliveries WHERE order_id = $1 FOR UPDATE', [
          normalizedOrderId,
        ]);
    const delivery = deliveryRes.rows[0];
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    const droneRes = await client.query('SELECT * FROM drones WHERE id = $1 FOR UPDATE', [
      normalizedDroneId,
    ]);
    const drone = droneRes.rows[0];
    if (!drone) {
      throw new Error('Drone not found');
    }

    const snapshot = {
      id: drone.id,
      code: drone.code,
      model: drone.model,
      max_payload: drone.max_payload,
      battery_level: drone.battery_level,
      hub_id: drone.hub_id,
    };

    const updatedDeliveryRes = await client.query(
      `
        UPDATE deliveries
        SET drone_id = $1,
            drone_snapshot = $2,
            delivery_status = 'assigned',
            updated_at = now()
        WHERE id = $3
        RETURNING *
      `,
      [normalizedDroneId, JSON.stringify(snapshot), delivery.id],
    );

    const updatedDroneRes = await client.query(
      `
        UPDATE drones
        SET status = 'assigned',
            last_active_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [normalizedDroneId],
    );

    await client.query(
      `
        INSERT INTO drone_assignments (delivery_id, drone_id, assigned_by)
        VALUES ($1, $2, $3)
      `,
      [delivery.id, normalizedDroneId, assignedBy ? normalizeUuid(assignedBy) : null],
    );

    await client.query('COMMIT');

    return {
      delivery: updatedDeliveryRes.rows[0],
      drone: updatedDroneRes.rows[0],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createDeliveryRecord,
  getDeliveriesByOrderIds,
  assignDelivery,
};
