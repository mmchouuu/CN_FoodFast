// api-gateway/src/services/admin.client.js
const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const client = createAxiosInstance({
  baseURL: `${config.userServiceUrl}/api/admin`,
  timeout: config.requestTimeout,
});

async function approveRestaurant(id, opts = {}) {
  const res = await client.put(`/approve-restaurant/${id}`, {}, { headers: opts.headers });
  return res.data;
}

async function listUsers(opts = {}) {
  const res = await client.get('/users', { headers: opts.headers });
  return res.data;
}

module.exports = { approveRestaurant, listUsers };
