// api-gateway/src/services/restaurant.client.js
const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const userClient = createAxiosInstance({
  baseURL: `${config.userServiceUrl}/api/restaurants`,
  timeout: config.requestTimeout,
});

const productClient = createAxiosInstance({
  baseURL: `${config.productServiceUrl}/api/restaurants`,
  timeout: config.requestTimeout,
});

const categoryClient = createAxiosInstance({
  baseURL: `${config.productServiceUrl}/api/categories`,
  timeout: config.requestTimeout,
});

function buildHeaders(req, extra = {}) {
  const headers = { ...(extra.headers || {}) };
  if (req?.id && !headers['x-request-id']) {
    headers['x-request-id'] = req.id;
  }
  return headers;
}

async function register(payload, opts = {}) {
  const res = await userClient.post('/register', payload, { headers: opts.headers });
  return res.data;
}

async function verify(payload, opts = {}) {
  const res = await userClient.post('/verify', payload, { headers: opts.headers });
  return res.data;
}

async function login(payload, opts = {}) {
  const res = await userClient.post('/login', payload, { headers: opts.headers });
  return res.data;
}

async function status(email, opts = {}) {
  const res = await userClient.get('/status', { params: { email }, headers: opts.headers });
  return res.data;
}

async function ownerAccount(id, opts = {}) {
  const res = await userClient.get(`/owners/${id}`, { headers: opts.headers });
  return res.data;
}

async function createRestaurant(payload, req) {
  const res = await productClient.post('/', payload, { headers: buildHeaders(req) });
  return res.data;
}

async function updateRestaurant(id, payload, req) {
  const res = await productClient.put(`/${id}`, payload, { headers: buildHeaders(req) });
  return res.data;
}

async function deleteRestaurant(id, req) {
  const res = await productClient.delete(`/${id}`, { headers: buildHeaders(req) });
  return res.data;
}

async function getRestaurant(id, req) {
  const res = await productClient.get(`/${id}`, { headers: buildHeaders(req) });
  return res.data;
}

async function listRestaurants(params = {}, req) {
  const res = await productClient.get('/', {
    params,
    headers: buildHeaders(req),
  });
  return res.data;
}

async function getRestaurantsByOwner(ownerId, req) {
  const res = await productClient.get(`/owner/${ownerId}/list`, { headers: buildHeaders(req) });
  return res.data;
}

async function getRestaurantByOwner(ownerId, req) {
  const res = await productClient.get(`/owner/${ownerId}`, { headers: buildHeaders(req) });
  return res.data;
}

async function listBranches(restaurantId, req) {
  const res = await productClient.get(`/${restaurantId}/branches`, { headers: buildHeaders(req) });
  return res.data;
}

async function createBranch(restaurantId, payload, req) {
  const res = await productClient.post(`/${restaurantId}/branches`, payload, { headers: buildHeaders(req) });
  return res.data;
}

async function updateBranch(restaurantId, branchId, payload, req) {
  const res = await productClient.put(`/${restaurantId}/branches/${branchId}`, payload, { headers: buildHeaders(req) });
  return res.data;
}

async function deleteBranch(restaurantId, branchId, req) {
  const res = await productClient.delete(`/${restaurantId}/branches/${branchId}`, { headers: buildHeaders(req) });
  return res.data;
}

async function listRestaurantProducts(restaurantId, params = {}, req) {
  const res = await productClient.get(`/${restaurantId}/products`, {
    params,
    headers: buildHeaders(req),
  });
  return res.data;
}

async function createRestaurantProduct(restaurantId, payload, req) {
  const res = await productClient.post(`/${restaurantId}/products`, payload, {
    headers: buildHeaders(req),
  });
  return res.data;
}

async function updateRestaurantProduct(restaurantId, productId, payload, req) {
  const res = await productClient.patch(
    `/${restaurantId}/products/${productId}`,
    payload,
    { headers: buildHeaders(req) },
  );
  return res.data;
}

async function deleteRestaurantProduct(restaurantId, productId, req) {
  const res = await productClient.delete(`/${restaurantId}/products/${productId}`, {
    headers: buildHeaders(req),
  });
  return res.data;
}

async function listRestaurantInventory(restaurantId, req) {
  const res = await productClient.get(`/${restaurantId}/inventory`, {
    headers: buildHeaders(req),
  });
  return res.data;
}

async function listProductInventory(restaurantId, productId, req) {
  const res = await productClient.get(`/${restaurantId}/products/${productId}/inventory`, {
    headers: buildHeaders(req),
  });
  return res.data;
}

async function listBranchInventory(restaurantId, branchId, req) {
  const res = await productClient.get(`/${restaurantId}/branches/${branchId}/inventory`, {
    headers: buildHeaders(req),
  });
  return res.data;
}

async function upsertBranchInventory(restaurantId, branchId, productId, payload, req) {
  const res = await productClient.put(
    `/${restaurantId}/branches/${branchId}/inventory/${productId}`,
    payload,
    { headers: buildHeaders(req) },
  );
  return res.data;
}

async function listCategories(params = {}, req) {
  const res = await categoryClient.get('/', {
    params,
    headers: buildHeaders(req),
  });
  return res.data;
}

async function createCategory(payload, req) {
  const res = await categoryClient.post('/', payload, {
    headers: buildHeaders(req),
  });
  return res.data;
}

async function updateCategory(id, payload, req) {
  const res = await categoryClient.patch(`/${id}`, payload, {
    headers: buildHeaders(req),
  });
  return res.data;
}

async function deleteCategory(id, req) {
  const res = await categoryClient.delete(`/${id}`, {
    headers: buildHeaders(req),
  });
  return res.data;
}

module.exports = {
  register,
  verify,
  login,
  status,
  ownerAccount,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listRestaurants,
  getRestaurant,
  getRestaurantsByOwner,
  getRestaurantByOwner,
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  listRestaurantProducts,
  createRestaurantProduct,
  updateRestaurantProduct,
  deleteRestaurantProduct,
  listRestaurantInventory,
  listProductInventory,
  listBranchInventory,
  upsertBranchInventory,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
