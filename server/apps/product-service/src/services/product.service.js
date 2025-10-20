import pool from '../db/index.js';
import { publishSocketEvent } from '../utils/rabbitmq.js';
import {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../models/product.model.js';

const ADMIN_RESTAURANT_ROOM = 'admin:restaurants';
const DEFAULT_ROOMS = ['catalog:restaurants', ADMIN_RESTAURANT_ROOM];
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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

export async function list(params = {}) {
  const query = { ...params };
  if (query.restaurantId) {
    query.restaurantId = ensureUuid(query.restaurantId, 'restaurant_id');
  }
  return listProducts(query);
}

export async function get(id) {
  const productId = ensureUuid(id, 'product_id');
  return getProductById(productId);
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

  const productPayload = { ...payload, restaurant_id: sanitizedRestaurantId };
  const product = await createProduct(productPayload);

  publishSocketEvent(
    'product.created',
    { productId: product.id, restaurantId: sanitizedRestaurantId, product },
    roomsForRestaurantEntity(restaurant),
  );

  return product;
}

export async function update(id, payload) {
  const productId = ensureUuid(id, 'product_id');
  const existing = await getProductById(productId);
  if (!existing) {
    return null;
  }

  let targetRestaurantId = existing.restaurant_id;
  let targetRestaurant = null;

  if (
    payload?.restaurant_id &&
    payload.restaurant_id !== existing.restaurant_id
  ) {
    targetRestaurantId = ensureUuid(payload.restaurant_id, 'restaurant_id');
    targetRestaurant = await fetchRestaurantMeta(targetRestaurantId);
    if (!targetRestaurant) {
      throw toNotFound('Restaurant not found');
    }
  }

  const updatePayload = { ...payload };
  if (payload?.restaurant_id) {
    updatePayload.restaurant_id = targetRestaurantId;
  }

  const updated = await updateProduct(productId, updatePayload);
  if (!updated) {
    return null;
  }

  if (!targetRestaurant) {
    targetRestaurantId = updated.restaurant_id;
    targetRestaurant = await fetchRestaurantMeta(targetRestaurantId);
  }

  publishSocketEvent(
    'product.updated',
    { productId: updated.id, restaurantId: updated.restaurant_id, product: updated },
    roomsForRestaurantEntity(targetRestaurant),
  );

  return updated;
}

export async function remove(id) {
  const productId = ensureUuid(id, 'product_id');
  const existing = await getProductById(productId);
  if (!existing) {
    return null;
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
