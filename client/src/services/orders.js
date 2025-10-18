import api from './api';

const basePath = '/api/orders';

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

const ordersService = {
  list: listOrders,
  get: getOrder,
  createOrder,
};

export default ordersService;

