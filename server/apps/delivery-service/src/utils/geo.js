const axios = require('axios');
const config = require('../config');
const logger = require('../logger');

const EARTH_RADIUS_M = 6371000;

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

async function getRouteMetrics(origin, destination) {
  const key = config.maptiler.key;
  if (!key) return null;
  if (!origin || !destination) return null;
  const base = config.maptiler.directionsUrl.replace(/\/$/, '');
  const path = `driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${base}/${path}`;
  try {
    const { data } = await axios.get(url, {
      params: {
        key,
        overview: 'full',
        geometries: 'polyline',
      },
      timeout: config.httpTimeout,
    });
    const route = data?.routes?.[0];
    if (route) {
      return {
        distanceMeters:
          typeof route.distance === 'number' ? route.distance : haversineDistanceMeters(origin, destination),
        durationSeconds: typeof route.duration === 'number' ? route.duration : null,
        geometry: route.geometry || null,
      };
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.debug?.('[delivery-service] Routing 404 (using fallback distance).');
      return null;
    }
    logger.warn('[delivery-service] Routing failed:', error.message);
  }
  return null;
}

module.exports = {
  normaliseCoordinate,
  haversineDistanceMeters,
  geocodeAddress,
  getRouteMetrics,
};
