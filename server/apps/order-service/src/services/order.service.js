const model = require('../models/order.model');

async function create(payload) {
  // payload validation omitted for brevity
  return model.createOrder(payload);
}
async function get(id) {
  return model.getOrder(id);
}
module.exports = { create, get };
