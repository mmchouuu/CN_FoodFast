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

async function listCustomers(opts = {}) {
  const res = await client.get('/customers', { headers: opts.headers });
  return res.data;
}

async function listRestaurants(opts = {}) {
  const res = await client.get('/restaurants', { headers: opts.headers });
  return res.data;
}

async function getUserDetails(id, opts = {}) {
  const res = await client.get(`/users/${id}`, { headers: opts.headers });
  return res.data;
}

async function updateUserActiveStatus(id, payload, opts = {}) {
  const res = await client.patch(`/users/${id}/active`, payload, { headers: opts.headers });
  return res.data;
}

module.exports = {
  approveRestaurant,
  listUsers,
  listCustomers,
  listRestaurants,
  getUserDetails,
  updateUserActiveStatus,
};
