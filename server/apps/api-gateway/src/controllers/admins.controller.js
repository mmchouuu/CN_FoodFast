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

module.exports = { approveRestaurant, listUsers };
