const DEFAULT_GEOCODER_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
const MAPSCO_GEOCODER_URL = process.env.GEOCODER_MAPSCO_URL || 'https://geocode.maps.co/search';
const DEFAULT_USER_AGENT = process.env.GEOCODER_USER_AGENT
  || `CNFoodFast/1.0 (${process.env.GEOCODER_EMAIL || 'support@foodfast.local'})`;
const GEOCODER_EMAIL = process.env.GEOCODER_EMAIL || process.env.GEOCODER_CONTACT || '';
const GEOCODER_LOCALE = process.env.GEOCODER_LOCALE || 'vi,en;q=0.8';
const PROVIDERS = (process.env.GEOCODER_PROVIDERS || 'nominatim,mapsco')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return search.toString();
}

async function doFetch(url, options = {}) {
  const fetchImpl = typeof fetch === 'function'
    ? fetch
    : (await import('node-fetch')).default;
  return fetchImpl(url, options);
}

function normaliseAddressPart(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function buildAddress({ street, ward, district, city }) {
  const parts = [
    normaliseAddressPart(street),
    normaliseAddressPart(ward),
    normaliseAddressPart(district),
    normaliseAddressPart(city),
  ].filter(Boolean);
  return parts.join(', ');
}

async function queryNominatim(query, signal) {
  const search = buildQuery({
    format: 'json',
    limit: 1,
    addressdetails: 0,
    q: query,
    email: GEOCODER_EMAIL || undefined,
  });

  const headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept': 'application/json',
    'Accept-Language': GEOCODER_LOCALE,
  };

  try {
    const response = await doFetch(`${DEFAULT_GEOCODER_URL}?${search}`, {
      method: 'GET',
      headers,
      signal,
    });
    if (!response.ok) {
      throw new Error(`Geocoder responded with status ${response.status}`);
    }
    const results = await response.json();
    if (!Array.isArray(results) || !results.length) return null;

    const { lat, lon } = results[0];
    const latitude = lat !== undefined ? Number.parseFloat(lat) : null;
    const longitude = lon !== undefined ? Number.parseFloat(lon) : null;

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        latitude,
        longitude,
        provider: 'nominatim',
        query,
      };
    }
    return null;
  } catch (error) {
    console.error('[product-service] Geocoding failed:', error.message);
    return null;
  }
}

async function queryMapsCo(query, signal) {
  const search = buildQuery({
    q: query,
    limit: 1,
  });
  try {
    const response = await doFetch(`${MAPSCO_GEOCODER_URL}?${search}`, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
        'Accept-Language': GEOCODER_LOCALE,
      },
      signal,
    });
    if (!response.ok) {
      throw new Error(`MapsCo responded with status ${response.status}`);
    }
    const results = await response.json();
    if (!Array.isArray(results) || !results.length) return null;
    const { lat, lon } = results[0];
    const latitude = lat !== undefined ? Number.parseFloat(lat) : null;
    const longitude = lon !== undefined ? Number.parseFloat(lon) : null;
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        latitude,
        longitude,
        provider: 'mapsco',
        query,
      };
    }
    return null;
  } catch (error) {
    console.error('[product-service] MapsCo geocoding failed:', error.message);
    return null;
  }
}

const PROVIDER_HANDLERS = {
  nominatim: queryNominatim,
  mapsco: queryMapsCo,
};

export async function geocodeAddress(payload = {}, { signal } = {}) {
  const query = buildAddress(payload);
  if (!query) return null;

  for (const provider of PROVIDERS.length ? PROVIDERS : ['nominatim', 'mapsco']) {
    const handler = PROVIDER_HANDLERS[provider];
    if (!handler) continue;
    const result = await handler(query, signal);
    if (result) return result;
  }
  return null;
}

export default geocodeAddress;
