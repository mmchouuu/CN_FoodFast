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

const paymentAdminClient = createAxiosInstance({
  baseURL: `${config.paymentServiceUrl}/admin`,
  timeout: config.requestTimeout,
});

const deliveryAdminClient = createAxiosInstance({
  baseURL: `${config.deliveryServiceUrl}/api/deliveries`,
  timeout: config.requestTimeout,
});

const orderAdminClient = createAxiosInstance({
  baseURL: `${config.orderServiceUrl}/admin/orders`,
  timeout: config.requestTimeout,
});

async function login(payload = {}, opts = {}) {
  const res = await userAdminClient.post('/login', payload, { headers: opts.headers });
  return res.data;
}

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

async function listPayoutRestaurants(params = {}, opts = {}) {
  const res = await paymentAdminClient.get('/payouts/restaurants', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function listPayoutBranches(restaurantId, params = {}, opts = {}) {
  const res = await paymentAdminClient.get(`/payouts/restaurants/${restaurantId}/branches`, {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function listSettlementOrders(settlementId, opts = {}) {
  const res = await paymentAdminClient.get(`/payouts/settlements/${settlementId}/orders`, {
    headers: opts.headers,
  });
  return res.data;
}

async function getDroneSystemSummary(opts = {}) {
  const res = await deliveryAdminClient.get('/admin/drone-hubs/system-summary', {
    headers: opts.headers,
  });
  return res.data;
}

async function listDroneHubs(opts = {}) {
  const res = await deliveryAdminClient.get('/admin/drone-hubs', {
    headers: opts.headers,
  });
  return res.data;
}

async function getDroneHubOverview(hubId, opts = {}) {
  const res = await deliveryAdminClient.get(`/admin/drone-hubs/${hubId}/overview`, {
    headers: opts.headers,
  });
  return res.data;
}

async function listPendingAssignmentOrders(params = {}, opts = {}) {
  const res = await orderAdminClient.get('/assignments/pending', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function listAssignmentOrders(params = {}, opts = {}) {
  const res = await orderAdminClient.get('/assignments', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function getAdminOrder(orderId, opts = {}) {
  if (!orderId) {
    throw new Error('orderId is required');
  }
  const res = await orderAdminClient.get(`/${orderId}`, {
    headers: opts.headers,
  });
  return res.data;
}

async function getDeliveryDroneSummary(params = {}, opts = {}) {
  const res = await deliveryAdminClient.get('/drones/summary', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function listDeliveryDrones(params = {}, opts = {}) {
  const res = await deliveryAdminClient.get('/drones', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function createDeliveryDrone(payload = {}, opts = {}) {
  const res = await deliveryAdminClient.post('/drones', payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function updateDeliveryDrone(id, payload = {}, opts = {}) {
  const res = await deliveryAdminClient.put(`/drones/${id}`, payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function deleteDeliveryDrone(id, opts = {}) {
  const res = await deliveryAdminClient.delete(`/drones/${id}`, {
    headers: opts.headers,
  });
  return res.data;
}

async function getDeliveryDroneLogs(id, opts = {}) {
  const res = await deliveryAdminClient.get(`/drones/${id}/logs`, {
    headers: opts.headers,
  });
  return res.data;
}

async function listDeliveries(params = {}, opts = {}) {
  const res = await deliveryAdminClient.get('/', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function listDeliveriesByOrders(params = {}, opts = {}) {
  const res = await deliveryAdminClient.get('/admin/deliveries', {
    params,
    headers: opts.headers,
  });
  return res.data;
}


async function assignDelivery(deliveryId, payload = {}, opts = {}) {
  const res = await deliveryAdminClient.post(`/admin/deliveries/${deliveryId}/assign`, payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function reprocessOrderAssignment(orderId, opts = {}) {
  const res = await deliveryAdminClient.post(
    `/admin/orders/${orderId}/reprocess-hub`,
    {},
    { headers: opts.headers, timeout: config.longRequestTimeout || config.requestTimeout },
  );
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
  login,
  listPayoutRestaurants,
  listPayoutBranches,
  listSettlementOrders,
  getDroneSystemSummary,
  listDroneHubs,
  getDroneHubOverview,
  listPendingAssignmentOrders,
  listAssignmentOrders,
  getAdminOrder,
  getDeliveryDroneSummary,
  listDeliveryDrones,
  createDeliveryDrone,
  updateDeliveryDrone,
  deleteDeliveryDrone,
  getDeliveryDroneLogs,
  listDeliveries,
  listDeliveriesByOrders,
  assignDelivery,
  reprocessOrderAssignment,
};
