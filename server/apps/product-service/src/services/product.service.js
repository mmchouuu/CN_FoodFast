const model = require('../models/product.model');

async function list({limit, offset}) {
  return model.listProducts(limit, offset);
}
async function get(id) {
  return model.getProductById(id);
}
module.exports = { list, get };
