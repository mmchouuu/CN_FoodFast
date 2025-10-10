const model = require('../models/payment.model');

async function create(payload){
  return model.createPayment(payload);
}
async function get(id){
  return model.getPayment(id);
}
module.exports = { create, get };
