import api from './api';

const basePath = '/customer/orders';
const ownerBasePath = '/owner/orders';

export async function listOrders() {
  const { data } = await api.get(basePath);
  return data;
}

export async function getOrder(orderId) {
  const { data } = await api.get(`${basePath}/${orderId}`);
  return data;
}

export async function createOrder(payload) {
  const { data } = await api.post(basePath, payload);
  return data;
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
  get: getOrder,
  createOrder,
  listOwner: listOwnerOrders,
  getOwner: getOwnerOrder,
  updateOwnerOrderStatus,
};

export default ordersService;

