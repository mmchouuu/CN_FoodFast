const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const userAdminClient = createAxiosInstance({
  baseURL: `${config.userServiceUrl}/api/admin`,
  timeout: config.requestTimeout,
});

const catalogAdminClient = createAxiosInstance({
  baseURL: `${config.productServiceUrl}/api/admin`,
  timeout: config.requestTimeout,
});

async function listCustomers(opts = {}) {
  const res = await userAdminClient.get('/customers', { headers: opts.headers });
  return res.data;
}

async function customerDetails(id, opts = {}) {
  const res = await userAdminClient.get(`/customers/${id}`, { headers: opts.headers });
  return res.data;
}

async function updateCustomerStatus(id, payload, opts = {}) {
  const res = await userAdminClient.patch(`/customers/${id}/status`, payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function listOwners(opts = {}) {
  const res = await userAdminClient.get('/owners', { headers: opts.headers });
  return res.data;
}

async function approveOwner(id, payload = {}, opts = {}) {
  const res = await userAdminClient.post(`/owners/${id}/approve`, payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function rejectOwner(id, payload = {}, opts = {}) {
  const res = await userAdminClient.post(`/owners/${id}/reject`, payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function createTaxTemplate(payload, opts = {}) {
  const res = await catalogAdminClient.post('/taxes', payload, { headers: opts.headers });
  return res.data;
}

async function assignTax(payload, opts = {}) {
  const res = await catalogAdminClient.post('/taxes/assignments', payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function createCalendar(payload, opts = {}) {
  const res = await catalogAdminClient.post('/calendars', payload, { headers: opts.headers });
  return res.data;
}

async function createGlobalPromotion(payload, opts = {}) {
  const res = await catalogAdminClient.post('/promotions/global', payload, {
    headers: opts.headers,
  });
  return res.data;
}

module.exports = {
  listCustomers,
  customerDetails,
  updateCustomerStatus,
  listOwners,
  approveOwner,
  rejectOwner,
  createTaxTemplate,
  assignTax,
  createCalendar,
  createGlobalPromotion,
};
