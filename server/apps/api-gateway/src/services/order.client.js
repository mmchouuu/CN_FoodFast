// api-gateway/src/services/order.client.js
const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const client = createAxiosInstance({
  baseURL: `${config.orderServiceUrl}/api/orders`,
  timeout: config.requestTimeout,
});

async function listOrders({ params = {}, headers = {} } = {}) {
  const res = await client.get('/', {
    headers,
    params,
  });
  return res.data;
}

async function getOrderById(orderId, { headers = {} } = {}) {
  const res = await client.get(`/${orderId}`, { headers });
  return res.data;
}

async function createOrder(payload, { headers = {} } = {}) {
  const res = await client.post('/', payload, { headers });
  return res.data;
}

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
};
