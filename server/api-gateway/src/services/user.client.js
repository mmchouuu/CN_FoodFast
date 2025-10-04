const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const client = createAxiosInstance({
  baseURL: config.userServiceUrl + '/api/users', // we will mount user-service routes under /api/users
  timeout: config.requestTimeout,
});

async function register(payload, opts = {}) {
  const res = await client.post('/register', payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function login(payload, opts = {}) {
  const res = await client.post('/login', payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function getAll(opts = {}) {
  const res = await client.get('/', { headers: opts.headers });
  return res.data;
}

async function health() {
  const res = await client.get('/health');
  return res.data;
}

module.exports = { register, login, getAll, health };

