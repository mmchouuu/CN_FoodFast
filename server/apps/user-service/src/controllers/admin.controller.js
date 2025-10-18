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

async function listCustomers(req, res, next) {
  try {
    const users = await adminService.listCustomers();
    res.json(users);
  } catch (err) { next(err); }
}

async function listRestaurants(req, res, next) {
  try {
    const users = await adminService.listRestaurants();
    res.json(users);
  } catch (err) { next(err); }
}

async function getUserDetails(req, res, next) {
  try {
    const { id } = req.params;
    const details = await adminService.getUserDetails(id);
    res.json(details);
  } catch (err) { next(err); }
}

async function updateActiveStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { is_active, action } = req.body;
    if (typeof is_active !== 'boolean' && !action) {
      return res.status(400).json({ message: 'Provide is_active boolean or action' });
    }
    const updated = await adminService.setUserActiveStatus(id, { is_active, action });
    res.json(updated);
  } catch (err) { next(err); }
}

module.exports = {
  approveRestaurant,
  listUsers,
  listCustomers,
  listRestaurants,
  getUserDetails,
  updateActiveStatus,
};
