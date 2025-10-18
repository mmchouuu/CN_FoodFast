// api-gateway/src/controllers/admins.controller.js
const adminClient = require('../services/admin.client');

// NOTE: these routes must be protected by auth+role middleware in production

async function approveRestaurant(req, res, next) {
  try {
    const { id } = req.params;
    const result = await adminClient.approveRestaurant(id, { headers: { 'x-request-id': req.id }});
    return res.json(result);
  } catch (err) { next(err); }
}

async function listUsers(req, res, next) {
  try {
    const users = await adminClient.listUsers({ headers: { 'x-request-id': req.id }});
    return res.json(users);
  } catch (err) { next(err); }
}

async function listCustomers(req, res, next) {
  try {
    const users = await adminClient.listCustomers({ headers: { 'x-request-id': req.id }});
    return res.json(users);
  } catch (err) { next(err); }
}

async function listRestaurants(req, res, next) {
  try {
    const users = await adminClient.listRestaurants({ headers: { 'x-request-id': req.id }});
    return res.json(users);
  } catch (err) { next(err); }
}

async function getUserDetails(req, res, next) {
  try {
    const { id } = req.params;
    const details = await adminClient.getUserDetails(id, { headers: { 'x-request-id': req.id }});
    return res.json(details);
  } catch (err) { next(err); }
}

async function updateUserActiveStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active, action } = req.body;
    const payload = {};
    if (typeof is_active === 'boolean') {
      payload.is_active = is_active;
    }
    if (action) {
      payload.action = action;
    }
    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: 'Provide is_active or action' });
    }
    const result = await adminClient.updateUserActiveStatus(
      id,
      payload,
      { headers: { 'x-request-id': req.id }},
    );
    return res.json(result);
  } catch (err) { next(err); }
}

module.exports = {
  approveRestaurant,
  listUsers,
  listCustomers,
  listRestaurants,
  getUserDetails,
  updateUserActiveStatus,
};
