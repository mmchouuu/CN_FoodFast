const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const ownerClient = createAxiosInstance({
  baseURL: `${config.userServiceUrl}/api/restaurants`,
  timeout: config.requestTimeout,
});

const catalogClient = createAxiosInstance({
  baseURL: `${config.productServiceUrl}/api/restaurants`,
  timeout: config.requestTimeout,
});

function toRequestHeaders(req, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (req?.id && !headers['x-request-id']) {
    headers['x-request-id'] = req.id;
  }
  return headers;
}

function withHeaders(req, opts = {}) {
  return toRequestHeaders(req, opts);
}

async function signupOwner(payload, opts = {}) {
  const res = await ownerClient.post('/signup', payload, { headers: opts.headers });
  return res.data;
}

async function verifyOwner(payload, opts = {}) {
  const res = await ownerClient.post('/verify', payload, { headers: opts.headers });
  return res.data;
}

async function ownerLogin(payload, opts = {}) {
  const res = await ownerClient.post('/login', payload, { headers: opts.headers });
  return res.data;
}

async function ownerStatus(email, opts = {}) {
  const res = await ownerClient.get('/status', {
    params: { email },
    headers: opts.headers,
  });
  return res.data;
}

async function resendVerification(payload, opts = {}) {
  const res = await ownerClient.post('/resend-verification', payload, {
    headers: opts.headers,
  });
  return res.data;
}

async function listCatalog(params = {}, opts = {}) {
  const res = await catalogClient.get('/catalog', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function getCatalog(restaurantId, params = {}, opts = {}) {
  const res = await catalogClient.get(`/${restaurantId}/catalog`, {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function createRestaurant(payload, req) {
  const res = await catalogClient.post('/', payload, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function getRestaurant(restaurantId, opts = {}) {
  const res = await catalogClient.get(`/${restaurantId}`, { headers: opts.headers });
  return res.data;
}

async function getRestaurantByOwner(ownerId, opts = {}) {
  const res = await catalogClient.get(`/owner/${ownerId}`, { headers: opts.headers });
  return res.data;
}

async function listRestaurantsByOwner(ownerId, opts = {}) {
  const res = await catalogClient.get(`/owner/${ownerId}/list`, { headers: opts.headers });
  return res.data;
}

async function updateRestaurant(restaurantId, payload, req) {
  const res = await catalogClient.put(`/${restaurantId}`, payload, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function createBranch(restaurantId, payload, req) {
  const res = await catalogClient.post(`/${restaurantId}/branches`, payload, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function listBranches(restaurantId, opts = {}) {
  const res = await catalogClient.get(`/${restaurantId}/branches`, {
    headers: opts.headers,
  });
  return res.data;
}

async function updateBranch(restaurantId, branchId, payload, req) {
  const res = await catalogClient.put(
    `/${restaurantId}/branches/${branchId}`,
    payload,
    { headers: withHeaders(req) },
  );
  return res.data;
}

async function updateBranchSchedules(restaurantId, branchId, payload, req) {
  const res = await catalogClient.put(
    `/${restaurantId}/branches/${branchId}/schedules`,
    payload,
    { headers: withHeaders(req) },
  );
  return res.data;
}

async function deleteBranch(restaurantId, branchId, req) {
  const res = await catalogClient.delete(`/${restaurantId}/branches/${branchId}`, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function inviteMember(restaurantId, payload, req) {
  const res = await catalogClient.post(`/${restaurantId}/members`, payload, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function createCategory(restaurantId, payload, req) {
  const res = await catalogClient.post(`/${restaurantId}/categories`, payload, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function listCategories(restaurantId, opts = {}) {
  const res = await catalogClient.get(`/${restaurantId}/categories`, { headers: opts.headers });
  return res.data;
}

async function createProduct(restaurantId, payload, req) {
  const res = await catalogClient.post(`/${restaurantId}/products`, payload, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function listProducts(restaurantId, opts = {}) {
  const res = await catalogClient.get(`/${restaurantId}/products`, { headers: opts.headers });
  return res.data;
}

async function updateProduct(restaurantId, productId, payload, req) {
  const res = await catalogClient.patch(
    `/${restaurantId}/products/${productId}`,
    payload,
    { headers: withHeaders(req) },
  );
  return res.data;
}

async function deleteProduct(restaurantId, productId, req) {
  const res = await catalogClient.delete(`/${restaurantId}/products/${productId}`, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function listInventory(restaurantId, productId, opts = {}) {
  const res = await catalogClient.get(
    `/${restaurantId}/products/${productId}/inventory`,
    { headers: opts.headers },
  );
  return res.data;
}

async function updateInventory(restaurantId, branchId, productId, payload, req) {
  const res = await catalogClient.put(
    `/${restaurantId}/branches/${branchId}/inventory/${productId}`,
    payload,
    { headers: withHeaders(req) },
  );
  return res.data;
}

async function createOptionGroup(restaurantId, productId, payload, req) {
  const res = await catalogClient.post(
    `/${restaurantId}/products/${productId}/options`,
    payload,
    { headers: withHeaders(req) },
  );
  return res.data;
}

async function createCombo(restaurantId, payload, req) {
  const res = await catalogClient.post(`/${restaurantId}/combos`, payload, {
    headers: withHeaders(req),
  });
  return res.data;
}

async function createPromotion(restaurantId, payload, req) {
  const body = {
    ...payload,
  };
  if (!body.scopeType) {
    body.scopeType = body.branchId ? 'branch' : 'restaurant';
  }
  const res = await catalogClient.post(`/${restaurantId}/promotions`, body, {
    headers: withHeaders(req),
  });
  return res.data;
}

module.exports = {
  signupOwner,
  verifyOwner,
  ownerLogin,
  ownerStatus,
  resendVerification,
  listCatalog,
  getCatalog,
  createRestaurant,
  getRestaurant,
  getRestaurantByOwner,
  listRestaurantsByOwner,
  updateRestaurant,
  createBranch,
  listBranches,
  updateBranch,
  updateBranchSchedules,
  deleteBranch,
  inviteMember,
  createCategory,
  listCategories,
  createProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  listInventory,
  updateInventory,
  createOptionGroup,
  createCombo,
  createPromotion,
};
