/* eslint-disable no-console */
require('dotenv').config();

const http = require('http');
const https = require('https');
const { URL } = require('url');

const LAN_HOST = process.env.LAN_IP || '26.62.36.103';
const DEFAULT_PORT = process.env.PORT || process.env.DELIVERY_SERVICE_PORT || 3006;
const SERVICE_BASE =
  process.env.SIMULATOR_BASE_URL || `http://${LAN_HOST}:${DEFAULT_PORT}`;
const DELIVERIES_URL = `${SERVICE_BASE}/api/deliveries`;
const TELEMETRY_URL = (droneId) => `${SERVICE_BASE}/api/deliveries/drones/${droneId}/telemetry`;

const INTERVAL_MS = Number(process.env.SIMULATOR_INTERVAL_MS || 1500);
const REFRESH_MS = Number(process.env.SIMULATOR_REFRESH_MS || 15000);
const SPEED_MPS = Number(process.env.SIMULATOR_SPEED_MPS || 25);
const MAX_ASSIGNMENTS = Number(process.env.SIMULATOR_MAX_ASSIGNMENTS || 8);
const BATTERY_DRAIN_PER_KM = Number(process.env.SIMULATOR_BATTERY_DRAIN_PER_KM || 2.5);

const ACTIVE_STATUSES = new Set([
  'assigned',
  'pending',
  'arriving',
  'flying',
  'delivering',
  'to_customer',
  'to_restaurant',
  'returning',
]);

const metersToDegrees = (meters) => meters / 111_111;

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normaliseCoordinate = (value) => {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const lng = toNumberOrNull(value[0]);
    const lat = toNumberOrNull(value[1]);
    if (lat !== null && lng !== null) {
      return { lat, lng };
    }
  }
  if (typeof value === 'object') {
    if (value.location) return normaliseCoordinate(value.location);
    const lat = toNumberOrNull(value.lat ?? value.latitude ?? value[1]);
    const lng = toNumberOrNull(value.lng ?? value.lon ?? value.longitude ?? value[0]);
    if (lat !== null && lng !== null) {
      return { lat, lng };
    }
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normaliseCoordinate(parsed);
    } catch {
      const parts = value.split(',').map((part) => toNumberOrNull(part.trim()));
      if (parts.length >= 2 && parts[0] !== null && parts[1] !== null) {
        return { lat: parts[1], lng: parts[0] };
      }
    }
  }
  return null;
};

const haversineMeters = (a, b) => {
  if (!a || !b) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return 6371000 * c;
};

const moveTowards = (current, target, stepMeters) => {
  if (!current || !target) return { position: current, arrived: true, distance: null };
  const distance = haversineMeters(current, target);
  if (!Number.isFinite(distance) || distance <= stepMeters) {
    return { position: target, arrived: true, distance };
  }
  const ratio = stepMeters / distance;
  return {
    position: {
      lat: current.lat + (target.lat - current.lat) * ratio,
      lng: current.lng + (target.lng - current.lng) * ratio,
    },
    arrived: false,
    distance,
  };
};

const stagePriority = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'returning') return 2;
  if (normalized === 'flying' || normalized === 'delivering' || normalized === 'to_customer') return 1;
  return 0;
};

const stageToStatus = (stage) => {
  if (stage === 'returning') return 'returning';
  if (stage === 'to_customer') return 'to_customer';
  if (stage === 'to_restaurant') return 'to_restaurant';
  return 'assigned';
};

const doRequest = (url, { method = 'GET', headers = {}, body } = {}) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const options = { method, headers };
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
    if (body) req.write(body);
    req.end();
  });

const assignments = new Map(); // key -> state

const buildTargets = (delivery) => {
  const hub = normaliseCoordinate(delivery?.drone?.hub?.location);
  const branch = normaliseCoordinate(delivery?.branch_location);
  const customer = normaliseCoordinate(
    delivery?.delivery_address?.location || delivery?.delivery_address,
  );
  const stages = [];
  if (branch) {
    stages.push({ type: 'to_restaurant', coordinate: branch });
  }
  if (customer) {
    stages.push({ type: 'to_customer', coordinate: customer });
  }
  if (hub) {
    stages.push({ type: 'returning', coordinate: hub });
  }
  return stages.filter((stage) => stage.coordinate);
};

const inferStartingStage = (delivery, stages) => {
  if (!stages.length) return 0;
  const idx = stagePriority(delivery?.delivery_status);
  return Math.min(idx, stages.length - 1);
};

const resolveInitialPosition = (delivery, stages) => {
  return (
    normaliseCoordinate(delivery?.current_position) ||
    normaliseCoordinate(delivery?.drone?.last_known_position) ||
    stages[0]?.coordinate ||
    null
  );
};

async function refreshAssignments() {
  try {
    const res = await doRequest(`${DELIVERIES_URL}?status=active&limit=50`);
    if (!res.ok) {
      console.warn('[simulator] failed to fetch deliveries', res.status, res.statusText);
      return;
    }
    const payload = res.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const activeKeys = new Set();

    items
      .filter((item) => item?.drone?.id && ACTIVE_STATUSES.has((item.delivery_status || '').toLowerCase()))
      .slice(0, MAX_ASSIGNMENTS)
      .forEach((delivery) => {
        const key = `${delivery.drone.id}:${delivery.id}`;
        activeKeys.add(key);
        const stages = buildTargets(delivery);
        if (!stages.length) return;
        const state = assignments.get(key) || {
          key,
          droneId: delivery.drone.id,
          droneCode: delivery.drone.code || delivery.drone.id,
          deliveryId: delivery.id,
          battery:
            toNumberOrNull(delivery.drone.battery_level) ??
            toNumberOrNull(delivery.drone_snapshot?.battery_level) ??
            100,
          speedMps: SPEED_MPS * (0.85 + Math.random() * 0.3),
        };

        state.stages = stages;
        state.stageIndex = inferStartingStage(delivery, stages);
        state.position = state.position || resolveInitialPosition(delivery, stages);
        state.completed = false;
        assignments.set(key, state);
      });

    Array.from(assignments.keys()).forEach((key) => {
      if (!activeKeys.has(key)) {
        assignments.delete(key);
      }
    });

    if (!assignments.size) {
      console.log('[simulator] No active deliveries with drones assigned.');
    }
  } catch (error) {
    console.warn('[simulator] refresh assignments failed:', error.message);
  }
}

async function sendTelemetry(state) {
  if (!state.position) return;
  const targetStage = state.stages[state.stageIndex];
  if (!targetStage) {
    state.completed = true;
    return;
  }
  const previousPosition = state.position;
  const stepMeters = state.speedMps * (INTERVAL_MS / 1000);
  const { position, arrived } = moveTowards(state.position, targetStage.coordinate, stepMeters);
  if (!position) return;

  state.position = position;
  if (arrived) {
    state.stageIndex += 1;
    if (state.stageIndex >= state.stages.length) {
      state.completed = true;
    }
  }

  const distanceKm = (haversineMeters(previousPosition || position, position) || 0) / 1000;
  if (distanceKm > 0) {
    state.battery = Math.max(5, state.battery - distanceKm * BATTERY_DRAIN_PER_KM);
  }

  const payload = JSON.stringify({
    lat: state.position.lat,
    lng: state.position.lng,
    deliveryId: state.deliveryId,
    batteryLevel: Math.round(state.battery),
    speed: Number(state.speedMps.toFixed(1)),
    heading: Math.floor(Math.random() * 360),
    status: stageToStatus(targetStage.type),
  });

  const res = await doRequest(TELEMETRY_URL(state.droneId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    body: payload,
  });

  if (!res.ok) {
    throw new Error(
      `Telemetry failed for ${state.droneCode}: ${res.status} ${res.statusText} - ${res.text}`,
    );
  }

  console.log(
    `[simulator] ${state.droneCode} (${stageToStatus(targetStage.type)}) -> ${state.position.lat.toFixed(5)}, ${state.position.lng.toFixed(5)} battery:${Math.round(state.battery)}%`,
  );
}

async function tick() {
  const states = Array.from(assignments.values());
  if (!states.length) return;
  await Promise.all(
    states
      .filter((state) => !state.completed)
      .map((state) => sendTelemetry(state).catch((err) => console.warn(err.message))),
  );
}

async function main() {
  console.log('[simulator] Starting drone delivery simulation via', SERVICE_BASE);
  await refreshAssignments();

  setInterval(refreshAssignments, REFRESH_MS);
  setInterval(tick, INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n[simulator] Stopped.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[simulator] Failed to start:', err);
  process.exit(1);
});
