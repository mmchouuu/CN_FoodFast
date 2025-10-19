// api-gateway/src/controllers/restaurants.controller.js
const restaurantClient = require('../services/restaurant.client');

async function register(req, res, next) {
  try {
    const payload = req.body;
    const required = ['restaurantName', 'companyAddress', 'taxCode', 'managerName', 'email'];
    const missing = required.filter((field) => !payload[field]);
    if (missing.length) {
      return res.status(400).json({ message: `missing fields: ${missing.join(', ')}` });
    }
    const result = await restaurantClient.register(payload, { headers: { 'x-request-id': req.id }});
    return res.status(201).json(result);
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const { email, otp, activationPassword, newPassword } = req.body;
    if (!email || !otp || !activationPassword || !newPassword) {
      return res.status(400).json({ message: 'email, otp, activationPassword and newPassword are required' });
    }
    const result = await restaurantClient.verify(
      { email, otp, activationPassword, newPassword },
      { headers: { 'x-request-id': req.id }},
    );
    return res.json(result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const result = await restaurantClient.login(req.body, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

async function status(req, res, next) {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }
    const result = await restaurantClient.status(email, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

async function ownerAccount(req, res, next) {
  try {
    const { id } = req.params;
    const result = await restaurantClient.ownerAccount(id, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

function sendCatalogError(err, res, next) {
  if (err.status) {
    return res.status(err.status).json(err.data || { message: err.message });
  }
  return next(err);
}

async function createRestaurant(req, res, next) {
  try {
    const result = await restaurantClient.createRestaurant(req.body, req);
    return res.status(201).json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function updateRestaurant(req, res, next) {
  try {
    const result = await restaurantClient.updateRestaurant(req.params.id, req.body, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function deleteRestaurant(req, res, next) {
  try {
    const result = await restaurantClient.deleteRestaurant(req.params.id, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function getRestaurant(req, res, next) {
  try {
    const result = await restaurantClient.getRestaurant(req.params.id, req);
    if (!result) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function getOwnerRestaurants(req, res, next) {
  try {
    const result = await restaurantClient.getRestaurantsByOwner(req.params.ownerId, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function getOwnerRestaurantDetail(req, res, next) {
  try {
    const result = await restaurantClient.getRestaurantByOwner(req.params.ownerId, req);
    if (!result) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function listBranches(req, res, next) {
  try {
    const result = await restaurantClient.listBranches(req.params.id, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function createBranch(req, res, next) {
  try {
    const result = await restaurantClient.createBranch(req.params.id, req.body, req);
    return res.status(201).json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function updateBranch(req, res, next) {
  try {
    const result = await restaurantClient.updateBranch(req.params.id, req.params.branchId, req.body, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
}

async function deleteBranch(req, res, next) {
  try {
    const result = await restaurantClient.deleteBranch(req.params.id, req.params.branchId, req);
    return res.json(result);
  } catch (err) { return sendCatalogError(err, res, next); }
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
  getRestaurant,
  getOwnerRestaurants,
  getOwnerRestaurantDetail,
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
};
