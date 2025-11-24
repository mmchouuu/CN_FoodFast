/* eslint-disable no-console */
require('dotenv').config();

const { pool } = require('../src/db');
const geo = require('../src/utils/geo');

const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE || 200);

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const normaliseCoordinate = geo.normaliseCoordinate;

const buildRoute = async (branchCoordinate, customerCoordinate) => {
  if (!branchCoordinate || !customerCoordinate) return null;
  const metrics = await geo.getRouteMetrics(branchCoordinate, customerCoordinate);
  const distance =
    metrics?.distanceMeters ?? geo.haversineDistanceMeters(branchCoordinate, customerCoordinate) ?? null;
  const duration = metrics?.durationSeconds ?? null;
  return {
    version: 'v2',
    waypoints: [branchCoordinate, customerCoordinate],
    legs: [
      {
        label: 'branch_to_customer',
        distance_meters: distance,
        duration_seconds: duration,
        geometry: metrics?.geometry || null,
        provider: metrics?.provider || null,
      },
    ],
    total_distance_meters: distance || null,
    total_duration_seconds: duration || null,
  };
};

async function fetchDeliveries(offset = 0, limit = BATCH_SIZE) {
  const { rows } = await pool.query(
    `
      SELECT id, branch_location, delivery_address, route, distance_meters, estimated_time_sec
      FROM deliveries
      ORDER BY created_at ASC
      OFFSET $1
      LIMIT $2
    `,
    [offset, limit],
  );
  return rows || [];
}

const hasGeometry = (route) => {
  if (!route || !Array.isArray(route.legs)) return false;
  return route.legs.some(
    (leg) =>
      leg &&
      (leg.geometry?.coordinates?.length ||
        (typeof leg.geometry === 'string' && leg.geometry.length) ||
        (typeof leg.polyline === 'string' && leg.polyline.length)),
  );
};

const hasZeroCoordinate = (route) => {
  if (!route || !Array.isArray(route.legs)) return false;
  const isZeroish = (coord) => {
    if (!coord) return false;
    if (Array.isArray(coord) && coord.length >= 2) {
      const lng = Number(coord[0]);
      const lat = Number(coord[1]);
      return Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001;
    }
    if (typeof coord === 'object') {
      const lat = Number(coord.lat ?? coord.latitude ?? coord[1]);
      const lng = Number(coord.lng ?? coord.lon ?? coord.longitude ?? coord[0]);
      return Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001;
    }
    return false;
  };
  return route.legs.some((leg) => {
    if (!leg?.geometry?.coordinates) return false;
    return leg.geometry.coordinates.some(isZeroish);
  });
};

const needsRebuild = (route, branchCoordinate, customerCoordinate, existingDistance) => {
  const fallback = geo.haversineDistanceMeters(branchCoordinate, customerCoordinate) || 0;
  const tooLarge =
    typeof existingDistance === 'number' &&
    existingDistance > 0 &&
    fallback > 0 &&
    (existingDistance > fallback * 3 || existingDistance > 1_000_000); // 1000km
  const hasZero = hasZeroCoordinate(route);
  return tooLarge || hasZero || !hasGeometry(route);
};

async function backfill() {
  console.log('[backfill] Starting delivery route geometry backfill...');
  let offset = 0;
  let updated = 0;
  let skipped = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const deliveries = await fetchDeliveries(offset, BATCH_SIZE);
    if (!deliveries.length) break;
    // eslint-disable-next-line no-await-in-loop
    for (const delivery of deliveries) {
      const route = parseJson(delivery.route);
      const branchCoordinate = normaliseCoordinate(delivery.branch_location);
      const customerCoordinate = normaliseCoordinate(
        delivery.delivery_address?.location || delivery.delivery_address,
      );
      if (!branchCoordinate || !customerCoordinate) {
        console.warn('[backfill] Missing coordinates for delivery', delivery.id);
        skipped += 1;
        continue;
      }
      const shouldRebuild = needsRebuild(route, branchCoordinate, customerCoordinate, delivery.distance_meters);
      if (!shouldRebuild) {
        skipped += 1;
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const newRoute = await buildRoute(branchCoordinate, customerCoordinate);
        if (!newRoute) {
          console.warn('[backfill] Failed to build route for delivery', delivery.id);
          skipped += 1;
          continue;
        }
        const distanceMeters =
          newRoute.total_distance_meters ??
          geo.haversineDistanceMeters(branchCoordinate, customerCoordinate);
        const durationSeconds = newRoute.total_duration_seconds ?? null;
        // eslint-disable-next-line no-await-in-loop
        await pool.query(
          `
            UPDATE deliveries
            SET route = $1,
                distance_meters = $2,
                estimated_time_sec = COALESCE($3, estimated_time_sec),
                updated_at = NOW()
            WHERE id = $4
          `,
          [JSON.stringify(newRoute), distanceMeters, durationSeconds, delivery.id],
        );
        updated += 1;
        console.log('[backfill] Updated delivery', delivery.id);
      } catch (error) {
        console.warn('[backfill] Failed to update delivery', delivery.id, error.message);
        skipped += 1;
      }
    }
    offset += deliveries.length;
  }
  console.log('[backfill] Done.', { updated, skipped });
  process.exit(0);
}

backfill().catch((err) => {
  console.error('[backfill] Fatal error', err);
  process.exit(1);
});
