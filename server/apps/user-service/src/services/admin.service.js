// user-service/src/services/admin.service.js

const userModel = require('../models/user.model');
const restaurantService = require('../services/restaurant.service');

async function approveRestaurantById(id) {
  const user = await userModel.findById(id);
  if (!user) throw new Error('Restaurant not found');
  if (user.role !== 'restaurant') throw new Error('User is not a restaurant');

  return restaurantService.approveRestaurant(id);
}

async function getAllUsers() {
  return userModel.getAll();
}

async function listCustomers() {
  return userModel.listByRole('customer');
}

async function listRestaurants() {
  return userModel.listByRole('restaurant');
}

async function setUserActiveStatus(id, options = {}) {
  const user = await userModel.findById(id);
  if (!user) throw new Error('User not found');

  const normalized =
    typeof options === 'boolean'
      ? { isActive: options }
      : {
          isActive:
            typeof options.isActive === 'boolean'
              ? options.isActive
              : typeof options.is_active === 'boolean'
              ? options.is_active
              : undefined,
          action: options.action,
        };

  if (user.role === 'restaurant') {
    if (normalized.action) {
      return restaurantService.moderateRestaurant(id, normalized.action);
    }
    if (typeof normalized.isActive === 'boolean') {
      return restaurantService.moderateRestaurant(id, normalized.isActive ? 'active' : 'lock');
    }
    throw new Error('Invalid status payload');
  }

  if (typeof normalized.isActive !== 'boolean') {
    throw new Error('is_active must be boolean');
  }

  return userModel.setActiveStatus(id, normalized.isActive);
}

async function getUserDetails(id) {
  const user = await userModel.findById(id);
  if (!user) throw new Error('User not found');

  const addresses = await userModel.getAddressesByUserId(id);
  return { user, addresses };
}

module.exports = {
  approveRestaurantById,
  getAllUsers,
  listCustomers,
  listRestaurants,
  setUserActiveStatus,
  getUserDetails,
};
