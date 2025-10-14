// user-service/src/services/admin/service.js

const userModel = require('../models/user.model');
const restaurantService = require('../services/restaurant.service');

async function approveRestaurantById(id) {
  const user = await userModel.findById(id);
  if (!user) throw new Error('Restaurant not found');
  if (user.role !== 'restaurant') throw new Error('User is not a restaurant');

  // gọi hàm approve trong restaurantService
  const result = await restaurantService.approveRestaurant(id);

  // in message ra console
  console.log(result.message);

  // trả về kết quả cho controller / client
  return result;
}


async function getAllUsers() {
    return await userModel.getAll();
}

module.exports = { approveRestaurantById, getAllUsers };