import api from './api';

export async function fetchAssignmentSummary() {
  const { data } = await api.get('/api/admin/assignments/summary');
  return {
    pendingOrders: data?.pendingOrders ?? 0,
    availableDrones: data?.availableDrones ?? 0,
    inFlight: data?.inFlight ?? 0,
    avgEtaMinutes: data?.avgEtaMinutes ?? 0,
  };
}

export async function fetchAssignmentHub(hubId, params = {}) {
  if (!hubId) {
    throw new Error('hubId is required');
  }
  const { data } = await api.get(`/api/admin/assignments/hubs/${hubId}`, { params });
  return {
    hub: data?.hub || null,
    sortBy: data?.sortBy || params.sort || 'eta',
    orders: Array.isArray(data?.orders) ? data.orders : [],
    droneQueue: Array.isArray(data?.droneQueue) ? data.droneQueue : [],
  };
}

export async function assignOrderToDrone(orderId, payload) {
  if (!orderId) throw new Error('orderId is required');
  const { deliveryId, droneId } = payload || {};
  if (!deliveryId || !droneId) {
    throw new Error('deliveryId and droneId are required');
  }
  const { data } = await api.post(`/api/admin/assignments/orders/${orderId}/assign`, {
    deliveryId,
    droneId,
  });
  return data;
}

export async function fetchOrderHubInfo(orderId) {
  if (!orderId) {
    throw new Error('orderId is required');
  }
  const { data } = await api.get(`/api/admin/assignments/orders/${orderId}/hub`);
  return {
    orderId: data?.orderId || orderId,
    hubId: data?.hubId || data?.hub_id || null,
    hubName: data?.hubName || data?.hub_name || null,
    assignedHubDistance: data?.assignedHubDistance || data?.assigned_hub_distance || null,
  };
}
