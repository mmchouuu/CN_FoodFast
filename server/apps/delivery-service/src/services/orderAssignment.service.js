const { pool } = require('../db');
const productClient = require('../clients/product.client');
const orderClient = require('../clients/order.client');
const geo = require('../utils/geo');
const deliveriesService = require('./deliveries.service');
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

const normalizeText = (value) =>
  typeof value === 'string' && value.trim().length ? value.trim() : null;

const extractSnapshotCoordinate = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (snapshot.location) {
    const coord = geo.normaliseCoordinate(snapshot.location);
    if (coord) return coord;
  }
  return geo.normaliseCoordinate({
    lat: snapshot.lat ?? snapshot.latitude,
    lng: snapshot.lng ?? snapshot.lon ?? snapshot.longitude,
  });
};

const buildAddressParts = (source = {}) => ({
  street: normalizeText(source.street || source.address || source.line1),
  ward: normalizeText(source.ward || source.ward_name),
  district: normalizeText(source.district || source.district_name),
  city: normalizeText(source.city || source.city_name),
  country: normalizeText(source.country || source.country_name || 'Vietnam'),
  formatted: normalizeText(source.formatted),
});

async function resolveBranchCoordinate(branchId, shippingSnapshotRaw) {
  let branch = null;
  const shippingSnapshot =
    shippingSnapshotRaw && typeof shippingSnapshotRaw === 'object'
      ? shippingSnapshotRaw
      : null;
  if (branchId) {
    try {
      branch = await productClient.fetchBranchById(branchId);
    } catch (error) {
      logger.error(
        `[delivery-service] Failed to fetch branch ${branchId}:`,
        error.message || error,
      );
    }
  }

  const branchCoordinate =
    geo.normaliseCoordinate(branch?.location) ||
    geo.normaliseCoordinate({
      lat: branch?.lat ?? branch?.latitude,
      lng: branch?.lng ?? branch?.lon ?? branch?.longitude,
    });

  if (branchCoordinate) {
    return { coordinate: branchCoordinate, branch };
  }

  const addressParts =
    buildAddressParts({
      street: branch?.street || branch?.address,
      ward: branch?.ward,
      district: branch?.district,
      city: branch?.city,
      country: branch?.country,
      formatted: branch?.full_address || branch?.formatted_address,
    }) || {};

  if (shippingSnapshot) {
    addressParts.street = addressParts.street || shippingSnapshot.street || shippingSnapshot.address;
    addressParts.ward = addressParts.ward || shippingSnapshot.ward;
    addressParts.district = addressParts.district || shippingSnapshot.district;
    addressParts.city = addressParts.city || shippingSnapshot.city;
    addressParts.formatted = addressParts.formatted || shippingSnapshot.formatted;
  }

  const geocoded = await geo.geocodeAddress(addressParts);
  if (geocoded) {
    return { coordinate: geocoded, branch };
  }

  const snapshotCoordinate = extractSnapshotCoordinate(shippingSnapshot);
  if (snapshotCoordinate) {
    return { coordinate: snapshotCoordinate, branch };
  }

  if (shippingSnapshot) {
    const fallbackGeocode = await geo.geocodeAddress(buildAddressParts(shippingSnapshot));
    if (fallbackGeocode) {
      return { coordinate: fallbackGeocode, branch };
    }
  }

  return { coordinate: null, branch };
}

async function fetchAllHubs() {
  const { rows } = await pool.query(
    `SELECT id, name, address, district, ward, zone_name, location
     FROM drone_hubs`,
  );
  return rows || [];
}

async function computeHubMetrics(hub, branchCoordinate) {
  const hubCoordinate =
    geo.normaliseCoordinate(hub.location) ||
    geo.normaliseCoordinate({
      lat: hub.lat ?? hub.latitude,
      lng: hub.lng ?? hub.lon ?? hub.longitude,
    });
  if (!hubCoordinate || !branchCoordinate) {
    return null;
  }
  const metrics = (await geo.getRouteMetrics(hubCoordinate, branchCoordinate)) || {};
  const fallbackDistance = geo.haversineDistanceMeters(hubCoordinate, branchCoordinate);
  return {
    hub,
    hubCoordinate,
    distanceMeters: metrics.distanceMeters ?? fallbackDistance,
    durationSeconds: metrics.durationSeconds ?? null,
  };
}

async function selectNearestHub(branchCoordinate, hubs) {
  if (!branchCoordinate || !Array.isArray(hubs) || !hubs.length) {
    return null;
  }
  let best = null;
  for (const hub of hubs) {
    try {
      const metrics = await computeHubMetrics(hub, branchCoordinate);
      if (!metrics || typeof metrics.distanceMeters !== 'number') continue;
      if (!best || metrics.distanceMeters < best.distanceMeters) {
        best = metrics;
      }
    } catch (error) {
      logger.warn(
        `[delivery-service] Failed to compute distance for hub ${hub.id}:`,
        error.message,
      );
    }
  }
  return best;
}

async function resolveCustomerCoordinate(snapshotRaw) {
  if (!snapshotRaw || typeof snapshotRaw !== 'object') {
    return { coordinate: null, snapshot: null };
  }
  const snapshot = { ...snapshotRaw };
  const direct = extractSnapshotCoordinate(snapshot);
  if (direct) {
    snapshot.location = direct;
    return { coordinate: direct, snapshot };
  }
  const geocoded = await geo.geocodeAddress(buildAddressParts(snapshot));
  if (geocoded) {
    snapshot.location = geocoded;
    return { coordinate: geocoded, snapshot };
  }
  return { coordinate: null, snapshot };
}

async function handleOrderCreated(payload = {}) {
  const orderId = payload.order_id || payload.id;
  if (!orderId) {
    return;
  }

  let branchId = payload.branch_id || payload.branchId || null;
  let rawShippingSnapshot =
    payload.shipping_address_snapshot &&
    typeof payload.shipping_address_snapshot === 'object'
      ? { ...payload.shipping_address_snapshot }
      : null;

  if (!branchId || !rawShippingSnapshot) {
    try {
      const order = await orderClient.getOrder(orderId);
      if (order) {
        branchId = branchId || order.branch_id || order.branchId || null;
        let snapshot =
          order.shipping_address_snapshot ||
          order.delivery_snapshot ||
          (order.metadata && order.metadata.delivery_address);
        if (snapshot) {
          if (typeof snapshot === 'string') {
            try {
              snapshot = JSON.parse(snapshot);
            } catch {
              snapshot = { formatted: snapshot };
            }
          }
          rawShippingSnapshot = snapshot;
        }
      }
    } catch (error) {
      logger.warn(
        `[delivery-service] Unable to fetch order ${orderId} for assignment:`,
        error.message,
      );
    }
  }

  const { coordinate: branchCoordinate, branch } = await resolveBranchCoordinate(
    branchId,
    rawShippingSnapshot,
  );

  if (!branchCoordinate) {
    logger.warn(
      `[delivery-service] Unable to resolve branch coordinates for order ${orderId}; skipping hub assignment`,
    );
    return;
  }

  const { coordinate: customerCoordinate, snapshot: shippingSnapshot } =
    await resolveCustomerCoordinate(rawShippingSnapshot);

  const hubs = await fetchAllHubs();
  if (!hubs.length) {
    logger.warn('[delivery-service] No hubs configured; cannot assign order to hub');
    return;
  }

  const best = await selectNearestHub(branchCoordinate, hubs);
  if (!best || !best.hub?.id) {
    logger.warn(
      `[delivery-service] Failed to determine nearest hub for order ${orderId}`,
    );
    return;
  }

  try {
    await orderClient.updateOrder(orderId, {
      assigned_hub_id: best.hub.id,
      assigned_hub_distance_m:
        typeof best.distanceMeters === 'number'
          ? Math.round(best.distanceMeters)
          : null,
    });
    logger.info(
      `[delivery-service] Assigned order ${orderId} to hub ${best.hub.name} (${best.hub.id})`,
    );
  } catch (error) {
    logger.error(
      `[delivery-service] Failed to update order ${orderId} with hub assignment:`,
      error.message || error,
    );
  }

  try {
    await deliveriesService.createDeliveryRecord({
      orderId,
      branchId: branchId || branch?.id || payload.branch_id || payload.branchId || null,
      hubCoordinate: best.hubCoordinate || geo.normaliseCoordinate(best.hub.location),
      branchCoordinate,
      customerCoordinate,
      shippingSnapshot,
    });
  } catch (error) {
    logger.error(
      `[delivery-service] Failed to create delivery record for order ${orderId}:`,
      error.message || error,
    );
  }
}

async function reprocessOrder(orderId) {
  const normalizedId = normalizeUuid(orderId);
  if (!normalizedId) {
    const err = new Error('orderId is required');
    err.status = 400;
    throw err;
  }
  const order = await orderClient.getOrder(normalizedId);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  let snapshot = order.shipping_address_snapshot || order.delivery_snapshot || null;
  if (snapshot && typeof snapshot === 'string') {
    try {
      snapshot = JSON.parse(snapshot);
    } catch {
      snapshot = { formatted: snapshot };
    }
  }

  await handleOrderCreated({
    order_id: order.id,
    branch_id: order.branch_id,
    shipping_address_snapshot: snapshot,
  });
}

module.exports = {
  handleOrderCreated,
  reprocessOrder,
};
