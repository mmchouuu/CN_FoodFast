const axios = require('axios');
const config = require('../config');

const EARTH_RADIUS_KM = 6371;

function haversineDistance(coordA, coordB) {
  if (!coordA || !coordB) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(Number(coordB.lat) - Number(coordA.lat));
  const dLng = toRad(Number(coordB.lng) - Number(coordA.lng));
  const lat1 = toRad(Number(coordA.lat));
  const lat2 = toRad(Number(coordB.lat));

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c * 1000; // meters
}

function normaliseCoordinate(value) {
  if (!value) return null;
  if (typeof value.lat === 'number' && typeof value.lng === 'number') {
    return { lat: value.lat, lng: value.lng };
  }
  if (Array.isArray(value) && value.length >= 2) {
    return { lat: Number(value[1]), lng: Number(value[0]) };
  }
  if (value.latitude !== undefined && value.longitude !== undefined) {
    return { lat: Number(value.latitude), lng: Number(value.longitude) };
  }
  if (value.lat !== undefined && value.lon !== undefined) {
    return { lat: Number(value.lat), lng: Number(value.lon) };
  }
  return null;
}

async function geocodeAddress(snapshot = {}) {
  if (!config.mapTilerKey) return null;
  const parts = [snapshot.street, snapshot.ward, snapshot.district, snapshot.city]
    .filter(Boolean)
    .join(', ')
    .trim();
  if (!parts) return null;
  const encoded = encodeURIComponent(parts);
  const url = `${config.mapTilerGeocodeUrl.replace(/\/$/, '')}/${encoded}.json`;
  try {
    const { data } = await axios.get(url, {
      params: {
        key: config.mapTilerKey,
        limit: 1,
      },
      timeout: config.requestTimeout,
    });
    const feature = data?.features?.[0];
    if (!feature?.center) return null;
    return { lat: Number(feature.center[1]), lng: Number(feature.center[0]) };
  } catch (error) {
    return null;
  }
}

async function resolveCoordinates(snapshot = {}) {
  const existing = normaliseCoordinate(snapshot.location);
  if (existing) return existing;
  return geocodeAddress(snapshot);
}

async function getRouteMetrics(origin, destination) {
  if (!origin || !destination) return null;
  if (!config.mapTilerKey) return null;
  const baseUrl = (config.mapTilerDirectionsUrl || '').replace(/\/$/, '');
  if (!baseUrl) return null;
  const path = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${baseUrl}/driving/${path}`;
  try {
    const { data } = await axios.get(url, {
      params: {
        key: config.mapTilerKey,
        overview: 'false',
        geometries: 'polyline',
      },
      timeout: config.requestTimeout,
    });
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      distanceMeters: typeof route.distance === 'number' ? route.distance : null,
      durationSeconds: typeof route.duration === 'number' ? route.duration : null,
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  haversineDistance,
  resolveCoordinates,
  getRouteMetrics,
  normaliseCoordinate,
};
