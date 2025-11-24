const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

const EARTH_RADIUS_M = 6371000;
const routeCache = new Map();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function normaliseCoordinate(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const lng = toNumberOrNull(value[0]);
    const lat = toNumberOrNull(value[1]);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  if (typeof value === 'object') {
    const lat = toNumberOrNull(value.lat ?? value.latitude ?? value[1]);
    const lng = toNumberOrNull(value.lng ?? value.lon ?? value.longitude ?? value[0]);
    if (lat !== null && lng !== null) {
      return { lat, lng };
    }
  }
  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => toNumberOrNull(part.trim()));
    if (parts.length >= 2 && parts[0] !== null && parts[1] !== null) {
      return { lat: parts[1], lng: parts[0] };
    }
  }
  return null;
}

function haversineDistanceMeters(a, b) {
  if (!a || !b) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_M * c;
}

const buildAddressString = (parts = {}) => {
  const fields = [
    parts.street || parts.address || parts.line1,
    parts.ward || parts.ward_name,
    parts.district || parts.district_name,
    parts.city || parts.city_name,
    parts.country || parts.country_name,
  ].filter((value) => typeof value === 'string' && value.trim().length);
  return fields.join(', ');
};

async function geocodeAddress(parts = {}) {
  const key = config.maptiler.key;
  if (!key) {
    return null;
  }
  const query = buildAddressString(parts) || parts.formatted || '';
  if (!query.trim()) {
    return null;
  }
  const base = config.maptiler.geocodeUrl.replace(/\/$/, '');
  const url = `${base}/${encodeURIComponent(query)}.json`;

  try {
    const { data } = await axios.get(url, {
      params: {
        key,
        limit: 1,
      },
      timeout: config.httpTimeout,
    });
    const center = data?.features?.[0]?.center;
    if (Array.isArray(center) && center.length >= 2) {
      return {
        lng: Number(center[0]),
        lat: Number(center[1]),
      };
    }
  } catch (error) {
    logger.warn('[delivery-service] Geocoding failed:', error.message);
  }
  return null;
}

const decodePolyline = (str) => {
  if (!str || typeof str !== 'string') return [];
  let index = 0;
  const len = str.length;
  const coordinates = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng * 1e-5, lat * 1e-5]);
  }
  return coordinates;
};

const encodeCacheKey = (origin, destination) => {
  const safe = (coord) => {
    if (!coord) return 'na,na';
    const lat = Number(coord.lat ?? coord.latitude ?? coord[1] ?? 0);
    const lng = Number(coord.lng ?? coord.lon ?? coord.longitude ?? coord[0] ?? 0);
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  };
  return `${safe(origin)}|${safe(destination)}`;
};

const setCache = (key, value) => {
  const ttl = config.cacheTtlMs || 300000;
  routeCache.set(key, { value, expiresAt: Date.now() + ttl });
};

const getCache = (key) => {
  const cached = routeCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt && cached.expiresAt < Date.now()) {
    routeCache.delete(key);
    return null;
  }
  return cached.value;
};

async function fetchOsrmRoute(origin, destination) {
  const base = (config.osrm?.baseUrl || '').replace(/\/$/, '');
  if (!base) return null;
  const path = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${base}/route/v1/driving/${path}`;
  const params = {
    overview: 'full',
    geometries: 'geojson',
  };
  const { data } = await axios.get(url, {
    params,
    timeout: config.httpTimeout,
  });
  const route = data?.routes?.[0];
  if (!route) return null;
  return {
    distanceMeters:
      typeof route.distance === 'number'
        ? route.distance
        : haversineDistanceMeters(origin, destination),
    durationSeconds: typeof route.duration === 'number' ? route.duration : null,
    geometry: route.geometry || null,
    provider: 'osrm',
  };
}

async function fetchMaptilerRoute(origin, destination) {
  const key = config.maptiler.key;
  if (!key) return null;
  const base = config.maptiler.directionsUrl.replace(/\/$/, '');
  const path = `driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${base}/${path}`;
  const { data } = await axios.get(url, {
    params: {
      key,
      overview: 'full',
      geometries: 'polyline',
    },
    timeout: config.httpTimeout,
  });
  const route = data?.routes?.[0];
  if (!route) return null;
  const coordinates = Array.isArray(route.geometry)
    ? route.geometry
    : decodePolyline(route.geometry || '');
  return {
    distanceMeters:
      typeof route.distance === 'number'
        ? route.distance
        : haversineDistanceMeters(origin, destination),
    durationSeconds: typeof route.duration === 'number' ? route.duration : null,
    geometry: {
      type: 'LineString',
      coordinates,
    },
    provider: 'maptiler',
  };
}

const sanitizeMetrics = (origin, destination, metrics) => {
  if (!metrics) return null;
  const fallback = haversineDistanceMeters(origin, destination);
  const distance = Number(metrics.distanceMeters);
  const duration = Number(metrics.durationSeconds);
  const tooLarge =
    Number.isFinite(distance) &&
    Number.isFinite(fallback) &&
    (distance > fallback * 3 || distance > 1_000_000); // cap at 1,000 km

  if (tooLarge && fallback) {
    return {
      distanceMeters: fallback,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      geometry: metrics.geometry || null,
      provider: metrics.provider || 'sanitized',
    };
  }
  return metrics;
};

async function getRouteMetrics(origin, destination) {
  if (!origin || !destination) return null;
  const key = encodeCacheKey(origin, destination);
  const cached = getCache(key);
  if (cached) {
    return cached;
  }

  try {
    const maptilerRoute = sanitizeMetrics(
      origin,
      destination,
      await fetchMaptilerRoute(origin, destination),
    );
    if (maptilerRoute) {
      setCache(key, maptilerRoute);
      return maptilerRoute;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.debug?.('[delivery-service] MapTiler routing 404 (using fallback distance).');
    } else {
      logger.warn('[delivery-service] MapTiler routing failed:', error.message);
    }
  }

  try {
    const fallback = sanitizeMetrics(origin, destination, await fetchOsrmRoute(origin, destination));
    if (fallback) {
      setCache(key, fallback);
      return fallback;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.debug?.('[delivery-service] OSRM routing 404 (using fallback distance).');
    } else {
      logger.warn('[delivery-service] OSRM routing failed:', error.message);
    }
  }

  return null;
}

module.exports = {
  normaliseCoordinate,
  haversineDistanceMeters,
  geocodeAddress,
  getRouteMetrics,
};
