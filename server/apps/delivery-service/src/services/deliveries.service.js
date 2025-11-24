const { pool } = require('../db');
const geo = require('../utils/geo');
const logger = require('../logger');
const orderClient = require('../clients/order.client');

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

const parseNumeric = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toComparableId = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).trim();
};

async function ensureCustomerAccess(orderId, customerId) {
  if (!customerId) return;
  const normalizedCustomerId = toComparableId(customerId);
  if (!normalizedCustomerId) return;

  const order = await orderClient.getOrder(orderId);
  if (!order) {
    const err = new Error('ORDER_NOT_FOUND');
    err.status = 404;
    throw err;
  }

  const candidateIds = [
    order.user_id,
    order.userId,
    order.customer_id,
    order.customerId,
    order.customer?.id,
    order.user?.id,
  ].map(toComparableId);

  const matching = candidateIds.find(
    (candidate) => candidate && candidate === normalizedCustomerId,
  );

  if (!matching) {
    const err = new Error('FORBIDDEN_DELIVERY_ACCESS');
    err.status = 403;
    throw err;
  }
}

async function buildRoute({ hubCoordinate, branchCoordinate, customerCoordinate }) {
  const legs = [];
  const waypoints = [];
  if (hubCoordinate) waypoints.push(hubCoordinate);
  if (branchCoordinate) waypoints.push(branchCoordinate);
  if (customerCoordinate) waypoints.push(customerCoordinate);

  let totalDistance = 0;
  let totalDuration = 0;

  const addLeg = async (from, to, label) => {
    if (!from || !to) return;
    const metrics = await geo.getRouteMetrics(from, to);
    const distance =
      metrics?.distanceMeters ??
      geo.haversineDistanceMeters(from, to) ??
      null;
    const duration = metrics?.durationSeconds ?? null;
    if (distance) totalDistance += distance;
    if (duration) totalDuration += duration;
    legs.push({
      label,
      distance_meters: distance,
      duration_seconds: duration,
      geometry:
        metrics?.geometry && Array.isArray(metrics.geometry.coordinates)
          ? metrics.geometry
          : null,
      provider: metrics?.provider || null,
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
      ORDER BY
        CASE WHEN drone_id IS NULL THEN 1 ELSE 0 END,
        updated_at DESC
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
  let orderIdForStatusUpdate = null;
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

    orderIdForStatusUpdate = delivery.order_id || null;

    const updatedDeliveryRes = await client.query(
      `
        UPDATE deliveries
        SET drone_id = $1,
            drone_snapshot = $2,
            delivery_status = 'to_restaurant',
            progress_percent = 0,
            pickup_at = NOW(),
            updated_at = now()
        WHERE id = $3
        RETURNING *
      `,
      [normalizedDroneId, JSON.stringify(snapshot), delivery.id],
    );

    const updatedDroneRes = await client.query(
      `
        UPDATE drones
        SET status = 'to_restaurant',
            last_active_at = now(),
            updated_at = now()
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

    if (orderIdForStatusUpdate) {
      orderClient
        .updateOrder(orderIdForStatusUpdate, { status: 'delivering' })
        .catch((error) => {
          logger.warn(
            '[delivery-service] Failed to push order delivering status for %s: %s',
            orderIdForStatusUpdate,
            error.message,
          );
        });
    }

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

async function getCustomerDelivery(orderId, customerId) {
  const normalizedOrderId = normalizeUuid(orderId);
  if (!normalizedOrderId) {
    const err = new Error('Invalid order id');
    err.status = 400;
    throw err;
  }

  try {
    await ensureCustomerAccess(normalizedOrderId, customerId);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }

  const deliveries = await getDeliveriesByOrderIds([normalizedOrderId]);
  if (!deliveries.length) {
    return null;
  }
  const withDrone = deliveries.find(
    (item) =>
      item?.drone_id ||
      (item?.drone_snapshot && typeof item.drone_snapshot === 'object'),
  );
  if (withDrone) {
    return withDrone;
  }
  return deliveries[0];
}

async function getCustomerDeliveryLogs(orderId, customerId, { limit = 50 } = {}) {
  const delivery = await getCustomerDelivery(orderId, customerId);
  if (!delivery) {
    return { deliveryId: null, logs: [] };
  }

  const parsedLimit = Number(limit);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(200, parsedLimit)) : 50;

  const { rows } = await pool.query(
    `
      SELECT id,
             drone_id,
             delivery_id,
             lat,
             lng,
             battery,
             speed,
             heading,
             status,
             created_at
      FROM drone_tracking_logs
      WHERE delivery_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [delivery.id, safeLimit],
  );

  const logs = rows.map((row) => ({
    id: row.id,
    deliveryId: row.delivery_id,
    droneId: row.drone_id,
    position:
      row.lat != null && row.lng != null
        ? { lat: Number(row.lat), lng: Number(row.lng) }
        : null,
    batteryLevel: parseNumeric(row.battery),
    speed: parseNumeric(row.speed),
    heading: parseNumeric(row.heading),
    status: row.status || null,
    recordedAt: row.created_at,
  }));

  return {
    deliveryId: delivery.id,
    logs,
  };
}

module.exports = {
  createDeliveryRecord,
  getDeliveriesByOrderIds,
  assignDelivery,
  getCustomerDelivery,
  getCustomerDeliveryLogs,
};
