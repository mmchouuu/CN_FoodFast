const model = require('../models/restaurant.model');

async function create(payload){
  return model.createRestaurant(payload);
}

async function list(params = {}){
  return model.listRestaurants(params);
}

async function get(id){
  return model.getRestaurantById(id);
}

async function update(id, payload){
  return model.updateRestaurant(id, payload);
}

async function remove(id){
  return model.deleteRestaurant(id);
}

module.exports = { create, list, get, update, remove };
