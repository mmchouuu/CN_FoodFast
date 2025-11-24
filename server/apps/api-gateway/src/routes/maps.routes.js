const express = require('express');
const axios = require('axios');
const config = require('../config');

const router = express.Router();

const CACHE_TTL_MS = Number(process.env.MAP_CACHE_TTL_MS || 5 * 60 * 1000);
const geocodeCache = new Map();
const routeCache = new Map();

const now = () => Date.now();
const setCache = (store, key, value) => {
  store.set(key, { value, expiresAt: now() + CACHE_TTL_MS });
};
const getCache = (store, key) => {
  const cached = store.get(key);
  if (!cached) return null;
  if (cached.expiresAt && cached.expiresAt < now()) {
    store.delete(key);
    return null;
  }
  return cached.value;
};

const buildAddressString = (parts = {}) =>
  [
    parts.query,
    parts.street || parts.address || parts.line1,
    parts.ward || parts.ward_name,
    parts.district || parts.district_name,
    parts.city || parts.city_name,
    parts.country || parts.country_name || 'Vietnam',
  ]
    .filter((value) => typeof value === 'string' && value.trim().length)
    .join(', ')
    .trim();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normaliseCoordinate = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value.location) return normaliseCoordinate(value.location);
  if (Array.isArray(value) && value.length >= 2) {
    const lng = toNumberOrNull(value[0]);
    const lat = toNumberOrNull(value[1]);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  if (typeof value === 'object') {
    const lat = toNumberOrNull(value.lat ?? value.latitude ?? value[1]);
    const lng = toNumberOrNull(value.lng ?? value.lon ?? value.longitude ?? value[0]);
    if (lat !== null && lng !== null) return { lat, lng };
  }
  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => toNumberOrNull(part.trim()));
    if (parts.length >= 2 && parts[0] !== null && parts[1] !== null) {
      return { lat: parts[1], lng: parts[0] };
    }
  }
  return null;
};

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

const toLineString = (geometry) => {
  if (!geometry) return null;
  const coordinates = Array.isArray(geometry) ? geometry : decodePolyline(geometry);
  if (!coordinates.length) return null;
  return { type: 'LineString', coordinates };
};

router.post('/geocode', async (req, res) => {
  const body = req.body || {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const addressParts = body.address || body.parts || {};
  const resolvedQuery = query || buildAddressString(addressParts);

  if (!resolvedQuery) {
    return res.status(400).json({ error: 'query is required' });
  }

  const cacheKey = resolvedQuery.toLowerCase();
  const cached = getCache(geocodeCache, cacheKey);
  if (cached) {
    return res.json({ cached: true, query: resolvedQuery, ...cached });
  }

  try {
    const base = (config.mapTilerGeocodeUrl || '').replace(/\/$/, '');
    const url = `${base}/${encodeURIComponent(resolvedQuery)}.json`;
    const { data } = await axios.get(url, {
      params: {
        key: config.mapTilerKey,
        limit: 1,
      },
      timeout: config.requestTimeout,
    });
    const feature = data?.features?.[0];
    if (!feature?.center) {
      return res.status(404).json({ error: 'Address not found', query: resolvedQuery });
    }
    const payload = {
      result: {
        location: { lat: Number(feature.center[1]), lng: Number(feature.center[0]) },
        name: feature.text || feature.place_name || resolvedQuery,
        formatted: feature.place_name || resolvedQuery,
        feature,
      },
    };
    setCache(geocodeCache, cacheKey, payload);
    return res.json({ cached: false, query: resolvedQuery, ...payload });
  } catch (error) {
    const status = error?.response?.status || 500;
    return res
      .status(status)
      .json({ error: 'Geocoding failed', details: error?.message || 'Unknown error' });
  }
});

router.post('/route', async (req, res) => {
  const body = req.body || {};
  const origin = normaliseCoordinate(body.origin || body.from);
  const destination = normaliseCoordinate(body.destination || body.to);
  const profile = typeof body.profile === 'string' ? body.profile : 'driving';
  const overview = body.overview || 'full';

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination are required' });
  }

  const cacheKey = `${profile}:${overview}:${origin.lat.toFixed(5)},${origin.lng.toFixed(
    5,
  )}|${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
  const cached = getCache(routeCache, cacheKey);
  if (cached) {
    return res.json({ cached: true, ...cached });
  }

  const maptilerBase = (config.mapTilerDirectionsUrl || '').replace(/\/$/, '');
  if (!config.mapTilerKey || !maptilerBase) {
    return res.status(500).json({ error: 'Routing provider is not configured' });
  }

  let lastError = null;
  try {
    const path = `${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${maptilerBase}/${path}`;
    const params = {
      key: config.mapTilerKey,
      overview,
      geometries: 'polyline',
    };
    const { data } = await axios.get(url, { params, timeout: config.longRequestTimeout });
    const route = data?.routes?.[0];
    if (route) {
      const payload = {
        provider: 'maptiler',
        distanceMeters: typeof route.distance === 'number' ? route.distance : null,
        durationSeconds: typeof route.duration === 'number' ? route.duration : null,
        geometry: toLineString(route.geometry),
        waypoints: data?.waypoints || [],
      };
      setCache(routeCache, cacheKey, payload);
      return res.json({ cached: false, ...payload });
    }
    const error = new Error('Route not found');
    error.status = 404;
    lastError = error;
  } catch (error) {
    lastError = error;
  }

  const osrmBase = (config.osrmBaseUrl || '').replace(/\/$/, '');
  if (osrmBase) {
    try {
      const path = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
      const url = `${osrmBase}/route/v1/${profile}/${path}`;
      const params = {
        overview,
        geometries: 'geojson',
        annotations: 'duration,distance',
      };
      const { data } = await axios.get(url, { params, timeout: config.longRequestTimeout });
      const route = data?.routes?.[0];
      if (route) {
        const payload = {
          provider: 'osrm',
          distanceMeters: typeof route.distance === 'number' ? route.distance : null,
          durationSeconds: typeof route.duration === 'number' ? route.duration : null,
          geometry: route.geometry || null,
          waypoints: data?.waypoints || [],
        };
        setCache(routeCache, cacheKey, payload);
        return res.json({ cached: false, ...payload });
      }
      const error = new Error('Route not found');
      error.status = 404;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
  }

  const status = lastError?.status || lastError?.response?.status || 500;
  return res
    .status(status)
    .json({ error: 'Routing failed', details: lastError?.message || 'Unknown error' });
});

module.exports = router;
