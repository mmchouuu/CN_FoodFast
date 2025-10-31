const config = require('../config');
const { createAxiosInstance } = require('../utils/httpClient');

const client = createAxiosInstance({
  baseURL: `${(config.orderServiceUrl || 'http://localhost:3003').replace(/\/+$/, '')}/api/orders`,
  timeout: config.requestTimeout,
});

const buildConfig = (opts = {}) => {
  const configPatch = {};
  if (opts.headers) {
    configPatch.headers = opts.headers;
  }
  if (opts.params) {
    configPatch.params = opts.params;
  }
  return configPatch;
};

async function listOrders(opts = {}) {
  const res = await client.get('/', buildConfig(opts));
  return res.data;
}

async function getOrderById(id, opts = {}) {
  const res = await client.get(`/${id}`, buildConfig(opts));
  return res.data;
}

async function listOrdersByUser(userId, opts = {}) {
  const res = await client.get(`/user/${userId}`, buildConfig(opts));
  return res.data;
}

async function createOrder(data, opts = {}) {
  const res = await client.post('/', data, buildConfig(opts));
  return res.data;
}

async function updateOrderStatus(id, status, opts = {}) {
  const res = await client.put(`/${id}/status`, { status }, buildConfig(opts));
  return res.data;
}

module.exports = {
  listOrders,
  getOrderById,
  listOrdersByUser,
  createOrder,
  updateOrderStatus,
};
