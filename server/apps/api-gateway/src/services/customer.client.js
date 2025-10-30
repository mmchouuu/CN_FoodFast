// api-gateway/src/services/customer.client.js
const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const client = createAxiosInstance({
  baseURL: `${config.userServiceUrl}/api/customers`,
  timeout: config.requestTimeout,
});

async function register(payload, opts = {}) {
  const res = await client.post('/signup', payload, { headers: opts.headers });
  return res.data;
}

async function verify(payload, opts = {}) {
  const res = await client.post('/verify', payload, { headers: opts.headers });
  return res.data;
}

async function login(payload, opts = {}) {
  const res = await client.post('/login', payload, { headers: opts.headers });
  return res.data;
}

async function listAddresses(opts = {}) {
  const res = await client.get('/me/addresses', { headers: opts.headers });
  return res.data;
}

async function createAddress(payload, opts = {}) {
  const res = await client.post('/me/addresses', payload, { headers: opts.headers });
  return res.data;
}

async function updateAddress(id, payload, opts = {}) {
  const res = await client.put(`/me/addresses/${id}`, payload, { headers: opts.headers });
  return res.data;
}

async function deleteAddress(id, opts = {}) {
  const res = await client.delete(`/me/addresses/${id}`, { headers: opts.headers });
  return res.data;
}

async function requestPasswordReset(payload, opts = {}) {
  const res = await client.post('/forgot-password', payload, { headers: opts.headers });
  return res.data;
}

async function resetPassword(payload, opts = {}) {
  const res = await client.post('/reset-password', payload, { headers: opts.headers });
  return res.data;
}

module.exports = {
  register,
  verify,
  login,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  requestPasswordReset,
  resetPassword,
};
