// api-gateway/src/services/restaurant.client.js
const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const client = createAxiosInstance({
  baseURL: `${config.userServiceUrl}/api/restaurants`,
  timeout: config.requestTimeout,
});

async function register(payload, opts = {}) {
  const res = await client.post('/register', payload, { headers: opts.headers });
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

module.exports = { register, verify, login };
