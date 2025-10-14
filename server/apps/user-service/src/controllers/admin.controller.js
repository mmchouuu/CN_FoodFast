// user-service/src/controllers/admin.controller.js

const adminService = require('../services/admin.service');

async function approveRestaurant(req, res, next) {
  try {
    const { id } = req.params;
    const result = await adminService.approveRestaurantById(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await adminService.getAllUsers();
    res.json(users);
  } catch (err) { next(err); }
}

module.exports = { approveRestaurant, listUsers };
