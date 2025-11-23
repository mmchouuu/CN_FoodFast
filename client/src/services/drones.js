import api from './api';

const basePath = '/owner/drones';

const buildParams = (params = {}) => {
  const { branchId } = params;
  if (branchId && branchId !== 'all') {
    return { branchId };
  }
  return undefined;
};

export async function fetchDroneSummary(params = {}) {
  const { data } = await api.get(`${basePath}/summary`, { params: buildParams(params) });
  return {
    active: data?.active ?? 0,
    inFlight: data?.inFlight ?? 0,
    completedToday: data?.completedToday ?? 0,
  };
}

export async function fetchDrones(params = {}) {
  const { data } = await api.get(basePath, { params: buildParams(params) });
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return Array.isArray(data) ? data : [];
}

export async function createDrone(payload) {
  const { data } = await api.post(basePath, payload);
  return data;
}

export async function updateDrone(id, payload) {
  const { data } = await api.put(`${basePath}/${id}`, payload);
  return data;
}

export async function removeDrone(id) {
  const { data } = await api.delete(`${basePath}/${id}`);
  return data;
}

export async function fetchDroneLogs(id) {
  const { data } = await api.get(`${basePath}/${id}/logs`);
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return Array.isArray(data) ? data : [];
}
