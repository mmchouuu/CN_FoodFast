const model = require('../models/product.model');

async function list(params = {}) {
  return model.listProducts(params);
}
async function get(id) {
  return model.getProductById(id);
}
async function create(payload){
  return model.createProduct(payload);
}
async function update(id, payload){
  return model.updateProduct(id, payload);
}
async function remove(id){
  return model.deleteProduct(id);
}
module.exports = { list, get, create, update, remove };
