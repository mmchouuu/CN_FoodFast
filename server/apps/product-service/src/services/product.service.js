import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../models/product.model.js';

export async function list(params = {}) {
  return listProducts(params);
}

export async function get(id) {
  return getProductById(id);
}

export async function create(payload) {
  return createProduct(payload);
}

export async function update(id, payload) {
  return updateProduct(id, payload);
}

export async function remove(id) {
  return deleteProduct(id);
}
