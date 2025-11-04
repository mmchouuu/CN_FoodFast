import api from './api';

const basePath = '/customer/orders';
const ownerBasePath = '/owner/orders';

const unwrapCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const unwrapRecord = (payload) => {
  if (!payload) return null;
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
};

export async function listOrders() {
  const { data } = await api.get(basePath);
  return unwrapCollection(data);
}

export async function listOrdersByUser(userId) {
  if (!userId) {
    throw new Error('userId is required to list orders by user');
  }
  const { data } = await api.get(`${basePath}/user/${userId}`);
  return unwrapCollection(data);
}

export async function getOrder(orderId) {
  const { data } = await api.get(`${basePath}/${orderId}`);
  return unwrapRecord(data);
}

export async function createOrder(payload) {
  const { data } = await api.post(basePath, payload);
  return Array.isArray(data) ? data : unwrapRecord(data);
}

export async function listOwnerOrders(params = {}) {
  const { data } = await api.get(ownerBasePath, { params });
  return data;
}

export async function getOwnerOrder(orderId) {
  const { data } = await api.get(`${ownerBasePath}/${orderId}`);
  return data;
}

export async function updateOwnerOrderStatus(orderId, payload) {
  const { data } = await api.patch(`${ownerBasePath}/${orderId}/status`, payload);
  return data;
}

const ordersService = {
  list: listOrders,
  listByUser: listOrdersByUser,
  get: getOrder,
  createOrder,
  listOwner: listOwnerOrders,
  getOwner: getOwnerOrder,
  updateOwnerOrderStatus,
};

export default ordersService;

