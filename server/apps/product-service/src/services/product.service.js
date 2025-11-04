// src/services/product.service.js
import pool from '../db/index.js';
import { publishSocketEvent } from '../utils/rabbitmq.js';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories as listCategoryRecords,
  findCategoryById,
  findCategoryByName,
  createCategory as createCategoryRecord,
  updateCategory as updateCategoryRecord,
  deleteCategory as deleteCategoryRecord,
} from '../models/product.model.js';
import {
  ensureForProduct as ensureInventoryForProduct,
  listByRestaurant as listInventoryByRestaurant,
  upsertBranchInventory,
} from './inventory.service.js';

const ADMIN_RESTAURANT_ROOM = 'admin:restaurants';
const DEFAULT_ROOMS = ['catalog:restaurants', ADMIN_RESTAURANT_ROOM];
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function toHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toBadRequest(message) {
  return toHttpError(message, 400);
}

function toNotFound(message) {
  return toHttpError(message, 404);
}

function uniqueRooms(...lists) {
  const acc = new Set();
  lists.forEach((list) => {
    if (!list) return;
    const items = Array.isArray(list) ? list : [list];
    items.filter(Boolean).forEach((item) => acc.add(item));
  });
  return Array.from(acc);
}

function roomsForRestaurantEntity(restaurant) {
  if (!restaurant) {
    return DEFAULT_ROOMS;
  }
  return uniqueRooms(
    DEFAULT_ROOMS,
    restaurant.id ? `restaurant:${restaurant.id}` : null,
    restaurant.owner_id ? `restaurant-owner:${restaurant.owner_id}` : null,
  );
}

async function fetchRestaurantMeta(restaurantId) {
  if (!restaurantId) return null;
  const { rows } = await pool.query(
    'SELECT id, owner_id FROM restaurants WHERE id = $1',
    [restaurantId],
  );
  return rows[0] || null;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function ensureUuid(value, fieldName = 'id') {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!isUuid(trimmed)) {
    throw toBadRequest(`${fieldName} must be a valid UUID`);
  }
  return trimmed;
}

function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sanitizeBranchInventories(rawInventories) {
  if (!rawInventories) return [];
  const entries = Array.isArray(rawInventories)
    ? rawInventories
    : typeof rawInventories === 'object'
      ? Object.entries(rawInventories).map(([branchId, value]) => ({
          branch_id: branchId,
          quantity:
            value && typeof value === 'object' ? value.quantity ?? value.qty ?? value.stock : value,
          reserved_qty: value?.reserved_qty ?? value?.reservedQty ?? null,
          min_stock: value?.min_stock ?? value?.minStock ?? null,
          daily_limit: value?.daily_limit ?? value?.dailyLimit ?? null,
          daily_sold: value?.daily_sold ?? value?.dailySold ?? null,
        }))
      : [];

  return entries
    .map((entry) => {
      const branchId = entry.branch_id ?? entry.branchId;
      if (!branchId) return null;
      let sanitizedBranchId;
      try {
        sanitizedBranchId = ensureUuid(branchId, 'branch_id');
      } catch (error) {
        return null;
      }
      const quantity = parseInteger(entry.quantity ?? entry.qty ?? entry.stock);
      const reservedQty = parseInteger(entry.reserved_qty ?? entry.reservedQty);
      const minStock = parseInteger(entry.min_stock ?? entry.minStock);
      const dailyLimit = parseInteger(entry.daily_limit ?? entry.dailyLimit);
      const dailySold = parseInteger(entry.daily_sold ?? entry.dailySold);

      const payload = {
        branchId: sanitizedBranchId,
        quantity,
        reserved_qty: reservedQty,
        min_stock: minStock,
        daily_limit: dailyLimit,
        daily_sold: dailySold,
      };

      if (Object.prototype.hasOwnProperty.call(entry, 'is_visible')) {
        payload.is_visible = entry.is_visible !== false;
      }
      if (Object.prototype.hasOwnProperty.call(entry, 'is_active')) {
        payload.is_active = entry.is_active !== false;
      }

      const hasData =
        quantity !== null ||
        reservedQty !== null ||
        minStock !== null ||
        dailyLimit !== null ||
        dailySold !== null ||
        Object.prototype.hasOwnProperty.call(payload, 'is_visible') ||
        Object.prototype.hasOwnProperty.call(payload, 'is_active');

      return hasData ? payload : null;
    })
    .filter(Boolean);
}

function buildInventoryUpdate(entry) {
  const update = {};
  if (entry.quantity !== null) {
    update.quantity = entry.quantity;
  }
  if (entry.reserved_qty !== null) {
    update.reserved_qty = entry.reserved_qty;
  }
  if (entry.min_stock !== null) {
    update.min_stock = entry.min_stock;
  }
  if (entry.daily_limit !== null) {
    update.daily_limit = entry.daily_limit;
  }
  if (entry.daily_sold !== null) {
    update.daily_sold = entry.daily_sold;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'is_visible')) {
    update.is_visible = entry.is_visible;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'is_active')) {
    update.is_active = entry.is_active;
  }
  return update;
}

function mapProductResponse(product) {
  if (!product) return null;
  const mapped = { ...product };
  mapped.is_active = product.is_visible !== false;
  mapped.available = product.available !== false;
  mapped.category = product.category || product.category_name || null;
  mapped.inventory_summary = {
    quantity: Number(product.inventory_quantity || 0),
    reserved_qty: Number(product.inventory_reserved || 0),
    daily_sold: Number(product.inventory_daily_sold || 0),
  };
  if (!Array.isArray(mapped.images)) {
    mapped.images = [];
  }
  return mapped;
}

export async function list(params = {}) {
  const query = { ...params };
  if (query.restaurant_id && !query.restaurantId) {
    query.restaurantId = query.restaurant_id;
  }
  if (query.restaurantId) {
    query.restaurantId = ensureUuid(query.restaurantId, 'restaurant_id');
  }
  const rows = await listProducts(query);
  return rows.map(mapProductResponse);
}

export async function get(id, options = {}) {
  const productId = ensureUuid(id, 'product_id');
  const product = await getProductById(productId);
  if (!product) {
    return null;
  }
  if (options.expectedRestaurantId && product.restaurant_id !== options.expectedRestaurantId) {
    throw toHttpError('Product does not belong to the specified restaurant', 403);
  }
  return mapProductResponse(product);
}

export async function create(payload) {
  const restaurantId = payload?.restaurant_id;
  if (!restaurantId) {
    throw toBadRequest('restaurant_id is required');
  }

  const sanitizedRestaurantId = ensureUuid(restaurantId, 'restaurant_id');

  const restaurant = await fetchRestaurantMeta(sanitizedRestaurantId);
  if (!restaurant) {
    throw toNotFound('Restaurant not found');
  }

  const categoryInput = {
    categoryId: payload.category_id || payload.categoryId,
    categoryName: payload.category || payload.category_name,
  };
  const resolvedCategory = categoryInput.categoryId || categoryInput.categoryName
    ? await resolveCategory({
        categoryId: categoryInput.categoryId,
        categoryName: categoryInput.categoryName,
        autoCreate: true,
      })
    : null;

  const branchInventories = sanitizeBranchInventories(
    payload.branch_inventories ?? payload.branchInventories ?? payload.inventory,
  );

  const productPayload = {
    ...payload,
    restaurant_id: sanitizedRestaurantId,
    category_id: resolvedCategory ? resolvedCategory.id : null,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'category')) {
    delete productPayload.category;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'category_name')) {
    delete productPayload.category_name;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'categoryId')) {
    delete productPayload.categoryId;
  }
  if (Object.prototype.hasOwnProperty.call(productPayload, 'branch_inventories')) {
    delete productPayload.branch_inventories;
  }
  if (Object.prototype.hasOwnProperty.call(productPayload, 'branchInventories')) {
    delete productPayload.branchInventories;
  }
  if (Object.prototype.hasOwnProperty.call(productPayload, 'inventory')) {
    delete productPayload.inventory;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) {
    const visible = payload.is_active !== false;
    productPayload.is_visible = visible;
    if (!Object.prototype.hasOwnProperty.call(productPayload, 'available')) {
      productPayload.available = visible;
    }
  }

  const created = await createProduct(productPayload);
  await ensureInventoryForProduct(sanitizedRestaurantId, created.id);
  if (branchInventories.length) {
    await Promise.all(
      branchInventories.map((entry) =>
        upsertBranchInventory(
          sanitizedRestaurantId,
          entry.branchId,
          created.id,
          buildInventoryUpdate(entry),
        ),
      ),
    );
  }
  const product = await getProductById(created.id);
  const mapped = mapProductResponse(product);
  if (resolvedCategory && !mapped.category) {
    mapped.category = resolvedCategory.name;
  }

  publishSocketEvent(
    'product.created',
    {
      productId: mapped.id,
      restaurantId: sanitizedRestaurantId,
      product: mapped,
    },
    roomsForRestaurantEntity(restaurant),
  );

  return mapped;
}

export async function update(id, payload = {}, options = {}) {
  const productId = ensureUuid(id, 'product_id');
  const existing = await getProductById(productId);
  if (!existing) {
    return null;
  }

  if (options.expectedRestaurantId && existing.restaurant_id !== options.expectedRestaurantId) {
    throw toHttpError('Product does not belong to the specified restaurant', 403);
  }

  if (
    payload?.restaurant_id &&
    payload.restaurant_id !== existing.restaurant_id
  ) {
    throw toBadRequest('Cannot move product to a different restaurant');
  }

  const branchInventories = sanitizeBranchInventories(
    payload.branch_inventories ?? payload.branchInventories ?? payload.inventory,
  );

  let resolvedCategory = null;
  const updatePayload = { ...payload };

  if (
    Object.prototype.hasOwnProperty.call(payload, 'category') ||
    Object.prototype.hasOwnProperty.call(payload, 'category_id') ||
    Object.prototype.hasOwnProperty.call(payload, 'categoryId') ||
    Object.prototype.hasOwnProperty.call(payload, 'category_name')
  ) {
    const categoryName =
      payload.category ?? payload.category_name ?? payload.categoryName ?? null;
    const categoryId = payload.category_id ?? payload.categoryId ?? null;

    if (!categoryName && !categoryId) {
      updatePayload.category_id = null;
    } else {
      resolvedCategory = await resolveCategory({
        categoryId,
        categoryName,
        autoCreate: true,
      });
      updatePayload.category_id = resolvedCategory ? resolvedCategory.id : null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updatePayload, 'category')) {
    delete updatePayload.category;
  }
  if (Object.prototype.hasOwnProperty.call(updatePayload, 'category_name')) {
    delete updatePayload.category_name;
  }
  if (Object.prototype.hasOwnProperty.call(updatePayload, 'categoryId')) {
    delete updatePayload.categoryId;
  }
  if (Object.prototype.hasOwnProperty.call(updatePayload, 'branch_inventories')) {
    delete updatePayload.branch_inventories;
  }
  if (Object.prototype.hasOwnProperty.call(updatePayload, 'branchInventories')) {
    delete updatePayload.branchInventories;
  }
  if (Object.prototype.hasOwnProperty.call(updatePayload, 'inventory')) {
    delete updatePayload.inventory;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) {
    const visible = payload.is_active !== false;
    updatePayload.is_visible = visible;
    if (!Object.prototype.hasOwnProperty.call(updatePayload, 'available')) {
      updatePayload.available = visible;
    }
  }

  const updated = await updateProduct(productId, updatePayload);
  if (!updated) {
    return null;
  }

  if (branchInventories.length) {
    await ensureInventoryForProduct(updated.restaurant_id, productId);
    await Promise.all(
      branchInventories.map((entry) =>
        upsertBranchInventory(
          updated.restaurant_id,
          entry.branchId,
          productId,
          buildInventoryUpdate(entry),
        ),
      ),
    );
  }

  const freshProduct = await getProductById(productId);
  const mapped = mapProductResponse(freshProduct || updated);
  const restaurant = await fetchRestaurantMeta(updated.restaurant_id);
  if (resolvedCategory && !mapped.category) {
    mapped.category = resolvedCategory.name;
  }

  publishSocketEvent(
    'product.updated',
    {
      productId: mapped.id,
      restaurantId: mapped.restaurant_id,
      product: mapped,
    },
    roomsForRestaurantEntity(restaurant),
  );

  return mapped;
}

export async function remove(id, options = {}) {
  const productId = ensureUuid(id, 'product_id');
  const existing = await getProductById(productId);
  if (!existing) {
    return null;
  }

  if (options.expectedRestaurantId && existing.restaurant_id !== options.expectedRestaurantId) {
    throw toHttpError('Product does not belong to the specified restaurant', 403);
  }

  const restaurant = await fetchRestaurantMeta(existing.restaurant_id);
  const deleted = await deleteProduct(productId);
  if (!deleted) {
    return null;
  }

  publishSocketEvent(
    'product.deleted',
    { productId: existing.id, restaurantId: existing.restaurant_id },
    roomsForRestaurantEntity(restaurant),
  );

  return deleted;
}

export async function listInventory(restaurantId) {
  const sanitisedRestaurantId = ensureUuid(restaurantId, 'restaurant_id');
  const restaurant = await fetchRestaurantMeta(sanitisedRestaurantId);
  if (!restaurant) {
    throw toNotFound('Restaurant not found');
  }
  return listInventoryByRestaurant(sanitisedRestaurantId);
}

async function resolveCategory({ categoryId, categoryName, autoCreate = true } = {}) {
  if (categoryId) {
    const existing = await findCategoryById(categoryId);
    if (existing) {
      return existing;
    }
    throw toNotFound('Category not found');
  }
  if (!categoryName) {
    return null;
  }
  const existing = await findCategoryByName(categoryName);
  if (existing) {
    return existing;
  }
  if (!autoCreate) {
    throw toNotFound('Category not found');
  }
  return createCategoryRecord({ name: categoryName });
}

export async function listCategories(params = {}) {
  return listCategoryRecords(params);
}

export async function createCategory(payload = {}) {
  const existing = await findCategoryByName(payload.name);
  if (existing) {
    return existing;
  }
  return createCategoryRecord(payload);
}

export async function updateCategory(id, payload = {}) {
  const category = await findCategoryById(id);
  if (!category) {
    throw toNotFound('Category not found');
  }
  if (payload.name) {
    const duplicate = await findCategoryByName(payload.name);
    if (duplicate && duplicate.id !== id) {
      throw toHttpError('Category name already exists', 409);
    }
  }
  return updateCategoryRecord(id, payload);
}

export async function removeCategory(id) {
  const category = await findCategoryById(id);
  if (!category) {
    return null;
  }
  await deleteCategoryRecord(id);
  return category;
}
