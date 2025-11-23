/* eslint-disable no-console */
require('dotenv').config();

const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_PORT = process.env.PORT || process.env.DELIVERY_SERVICE_PORT || 3006;
const BASE_URL = process.env.SIMULATOR_BASE_URL || `http://localhost:${DEFAULT_PORT}/api/deliveries`;
const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS || 1500);
const MAX_DRONES = Number(process.env.SIMULATOR_MAX_DRONES || 5);
const DRIFT_METERS = Number(process.env.SIMULATOR_DRIFT_METERS || 40); // per tick

const metersToDegrees = (meters) => meters / 111_111; // rough conversion

const randomDrift = () => {
  const delta = metersToDegrees(DRIFT_METERS);
  return {
    lat: (Math.random() - 0.5) * delta * 2,
    lng: (Math.random() - 0.5) * delta * 2,
  };
};

const doRequest = (url, { method = 'GET', headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const options = {
      method,
      headers,
    };
    const req = (isHttps ? https : http).request(parsed, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          text: data,
          json: () => {
            try {
              return JSON.parse(data || '{}');
            } catch (err) {
              throw err;
            }
          },
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });

async function fetchActiveDrones() {
  const res = await doRequest(`${BASE_URL}/drones?status=active`);
  if (!res.ok) {
    throw new Error(`Failed to fetch drones: ${res.status} ${res.statusText}`);
  }
  const payload = res.json();
  const drones = Array.isArray(payload?.data) ? payload.data : payload || [];
  return drones
    .filter((d) => d.last_known_position)
    .slice(0, MAX_DRONES)
    .map((d) => ({
      id: d.id,
      code: d.code,
      lat: Number(d.last_known_position.lat),
      lng: Number(d.last_known_position.lng),
      battery: Number.isFinite(Number(d.battery_level)) ? Number(d.battery_level) : 100,
    }))
    .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
}

async function sendTelemetry(drone) {
  const drift = randomDrift();
  drone.lat += drift.lat;
  drone.lng += drift.lng;
  drone.battery = Math.max(10, drone.battery - Math.random() * 0.5);
  const heading = Math.floor(Math.random() * 360);
  const speed = (5 + Math.random() * 8).toFixed(1);

  const body = JSON.stringify({
    lat: drone.lat,
    lng: drone.lng,
    batteryLevel: Math.round(drone.battery),
    speed: Number(speed),
    heading,
    status: 'flying',
  });

  const res = await doRequest(`${BASE_URL}/drones/${drone.id}/telemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    body,
  });
  if (!res.ok) {
    throw new Error(`Telemetry failed for ${drone.code}: ${res.status} ${res.statusText} - ${res.text}`);
  }
}

async function main() {
  console.log('[simulator] Loading active drones from', BASE_URL);
  const drones = await fetchActiveDrones();
  if (!drones.length) {
    console.log('[simulator] No active drones with last_known_position found. Seed your DB first.');
    return;
  }
  console.log(`[simulator] Simulating ${drones.length} drones every ${INTERVAL_MS}ms`);

  const timer = setInterval(async () => {
    const target = drones[Math.floor(Math.random() * drones.length)];
    try {
      await sendTelemetry(target);
      console.log(
        `[simulator] ${target.code} -> lat:${target.lat.toFixed(5)} lng:${target.lng.toFixed(5)} battery:${Math.round(target.battery)}%`
      );
    } catch (err) {
      console.error(err.message);
    }
  }, INTERVAL_MS);

  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log('\n[simulator] Stopped.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[simulator] Failed to start:', err);
  process.exit(1);
});
