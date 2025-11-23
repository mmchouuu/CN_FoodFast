import api from './api';

const basePath = '/api/admin';

export async function fetchDroneSystemSummary() {
  const { data } = await api.get(`${basePath}/drone-hubs/system-summary`);
  return {
    totalHubs: data?.totalHubs ?? 0,
    totalDrones: data?.totalDrones ?? 0,
    inFlight: data?.inFlight ?? 0,
    needsMaintenance: data?.needsMaintenance ?? 0,
  };
}

export async function fetchDroneHubs() {
  const { data } = await api.get(`${basePath}/drone-hubs`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchHubOverview(hubId) {
  if (!hubId) {
    throw new Error('hubId is required');
  }
  const { data } = await api.get(`${basePath}/drone-hubs/${hubId}/overview`);
  return {
    hub: data?.hub || null,
    overview: data?.overview || {
      coverage: null,
      active: 0,
      inFlight: 0,
      completedToday: 0,
    },
    performance: data?.performance || {
      avgBatteryLevel: 0,
      avgFlightTimeMinutes: 0,
      pendingAssignments: 0,
      maintenanceCount: 0,
    },
  };
}

const normaliseParams = (params = {}) => {
  const payload = {};
  if (params.hubId) payload.hubId = params.hubId;
  if (params.status) payload.status = params.status;
  if (params.search) payload.search = params.search;
  return payload;
};

export async function fetchAdminDrones(params = {}) {
  const { data } = await api.get(`${basePath}/drones`, { params: normaliseParams(params) });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function createAdminDrone(payload) {
  const { data } = await api.post(`${basePath}/drones`, payload);
  return data;
}

export async function updateAdminDrone(id, payload) {
  const { data } = await api.put(`${basePath}/drones/${id}`, payload);
  return data;
}

export async function deleteAdminDrone(id) {
  const { data } = await api.delete(`${basePath}/drones/${id}`);
  return data;
}

export async function fetchAdminDroneLogs(id) {
  const { data } = await api.get(`${basePath}/drones/${id}/logs`);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}
