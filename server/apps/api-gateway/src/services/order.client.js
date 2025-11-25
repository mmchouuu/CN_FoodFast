// api-gateway/src/services/order.client.js
const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

// Chuẩn hóa baseURL (loại bỏ dấu / thừa) rồi gắn /api/orders
const client = createAxiosInstance({
  baseURL: `${(config.orderServiceUrl || 'http://26.62.36.103:3003').replace(/\/+$/, '')}/api/orders`,
  timeout: config.requestTimeout,
});

function buildConfig({ headers = {}, params = {} } = {}) {
  const cfg = {};
  if (Object.keys(headers).length) cfg.headers = headers;
  if (Object.keys(params).length) cfg.params = params;
  return cfg;
}

async function listOrders({ params = {}, headers = {} } = {}) {
  const res = await client.get('/', buildConfig({ headers, params }));
  return res.data;
}

async function getOrderById(orderId, { headers = {} } = {}) {
  const res = await client.get(`/${orderId}`, buildConfig({ headers }));
  return res.data;
}

async function listOrdersByUser(userId, { headers = {}, params = {} } = {}) {
  const res = await client.get(`/user/${userId}`, buildConfig({ headers, params }));
  return res.data;
}

async function createOrder(payload, { headers = {} } = {}) {
  const res = await client.post('/', payload, buildConfig({ headers }));
  return res.data;
}

async function updateOrderStatus(orderId, status, { headers = {} } = {}) {
  const res = await client.put(`/${orderId}/status`, { status }, buildConfig({ headers }));
  return res.data;
}

async function cancelOrder(orderId, payload, { headers = {}, params = {} } = {}) {
  const res = await client.post(
    `/${orderId}/cancel`,
    payload,
    buildConfig({ headers, params }),
  );
  return res.data;
}

async function confirmOrder(orderId, payload, { headers = {}, params = {} } = {}) {
  const res = await client.post(
    `/${orderId}/complete`,
    payload,
    buildConfig({ headers, params }),
  );
  return res.data;
}

module.exports = {
  listOrders,
  getOrderById,
  listOrdersByUser,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  confirmOrder,
};
