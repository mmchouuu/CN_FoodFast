import pool from '../db/index.js';
import {
  listInventoryByRestaurant,
  listInventoryByProduct,
  listInventoryByBranch,
  upsertInventoryRecord,
  ensureInventoryRecords,
  deleteInventoryForProduct,
} from '../models/product.model.js';
import { getProductById } from '../models/product.model.js';

function toHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function fetchBranchMeta(branchId) {
  const res = await pool.query(
    'SELECT id, restaurant_id FROM restaurant_branches WHERE id = $1',
    [branchId],
  );
  return res.rows[0] || null;
}

export async function listByRestaurant(restaurantId) {
  return listInventoryByRestaurant(restaurantId);
}

export async function listByProduct(restaurantId, productId) {
  const product = await getProductById(productId);
  if (!product) {
    throw toHttpError('Product not found', 404);
  }
  if (product.restaurant_id !== restaurantId) {
    throw toHttpError('Product does not belong to the specified restaurant', 403);
  }
  return listInventoryByProduct(restaurantId, productId);
}

export async function listByBranch(restaurantId, branchId) {
  const branch = await fetchBranchMeta(branchId);
  if (!branch) {
    throw toHttpError('Branch not found', 404);
  }
  if (branch.restaurant_id !== restaurantId) {
    throw toHttpError('Branch does not belong to the specified restaurant', 403);
  }
  return listInventoryByBranch(restaurantId, branchId);
}

export async function ensureForProduct(restaurantId, productId) {
  const res = await pool.query(
    'SELECT id FROM restaurant_branches WHERE restaurant_id = $1',
    [restaurantId],
  );
  const branchIds = res.rows.map((row) => row.id);
  if (!branchIds.length) return 0;
  return ensureInventoryRecords(branchIds, productId);
}

export async function upsertBranchInventory(restaurantId, branchId, productId, payload = {}) {
  const product = await getProductById(productId);
  if (!product) {
    throw toHttpError('Product not found', 404);
  }
  if (product.restaurant_id !== restaurantId) {
    throw toHttpError('Product does not belong to the specified restaurant', 403);
  }

  const branch = await fetchBranchMeta(branchId);
  if (!branch) {
    throw toHttpError('Branch not found', 404);
  }
  if (branch.restaurant_id !== restaurantId) {
    throw toHttpError('Branch does not belong to the specified restaurant', 403);
  }

  const record = await upsertInventoryRecord({
    branch_id: branchId,
    product_id: productId,
    quantity: payload.quantity ?? null,
    reserved_qty: payload.reserved_qty ?? null,
    min_stock: payload.min_stock ?? null,
    last_restock_at: payload.last_restock_at ?? null,
    daily_limit: payload.daily_limit ?? null,
    daily_sold: payload.daily_sold ?? null,
    is_visible: payload.is_visible,
    is_active: payload.is_active,
  });
  return record;
}

export async function removeProductInventory(productId) {
  await deleteInventoryForProduct(productId);
}
