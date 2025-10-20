import * as inventoryService from '../services/inventory.service.js';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function ensureUuid(value, fieldName = 'id') {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!UUID_REGEX.test(trimmed)) {
    const error = new Error(`${fieldName} must be a valid UUID`);
    error.statusCode = 400;
    throw error;
  }
  return trimmed;
}

function handleServiceError(err, res, next) {
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return next(err);
}

function parseIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function normaliseInventoryPayload(body = {}) {
  const payload = { ...body };
  const quantity = parseIntOrNull(payload.quantity);
  if (quantity !== null) payload.quantity = quantity;

  const reserved = parseIntOrNull(payload.reserved_qty ?? payload.reservedQty);
  if (reserved !== null) payload.reserved_qty = reserved;

  const minStock = parseIntOrNull(payload.min_stock ?? payload.minStock);
  if (minStock !== null) payload.min_stock = minStock;

  const dailyLimit = parseIntOrNull(payload.daily_limit ?? payload.dailyLimit);
  if (dailyLimit !== null) payload.daily_limit = dailyLimit;

  const dailySold = parseIntOrNull(payload.daily_sold ?? payload.dailySold);
  if (dailySold !== null) payload.daily_sold = dailySold;

  if (payload.last_restock_at instanceof Date) {
    payload.last_restock_at = payload.last_restock_at.toISOString();
  }

  return payload;
}

export async function listRestaurantInventory(req, res, next) {
  try {
    const restaurantId = ensureUuid(
      req.params.restaurantId,
      'restaurant_id',
    );
    const items = await inventoryService.listByRestaurant(restaurantId);
    res.json({ data: items });
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function listProductInventory(req, res, next) {
  try {
    const restaurantId = ensureUuid(
      req.params.restaurantId,
      'restaurant_id',
    );
    const productId = ensureUuid(
      req.params.productId,
      'product_id',
    );
    const items = await inventoryService.listByProduct(restaurantId, productId);
    res.json({ data: items });
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function listBranchInventory(req, res, next) {
  try {
    const restaurantId = ensureUuid(
      req.params.restaurantId,
      'restaurant_id',
    );
    const branchId = ensureUuid(
      req.params.branchId,
      'branch_id',
    );
    const items = await inventoryService.listByBranch(restaurantId, branchId);
    res.json({ data: items });
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function upsertBranchInventory(req, res, next) {
  try {
    const restaurantId = ensureUuid(
      req.params.restaurantId,
      'restaurant_id',
    );
    const branchId = ensureUuid(
      req.params.branchId,
      'branch_id',
    );
    const productId = ensureUuid(
      req.params.productId,
      'product_id',
    );
    const payload = normaliseInventoryPayload(req.body);
    const record = await inventoryService.upsertBranchInventory(
      restaurantId,
      branchId,
      productId,
      payload,
    );
    res.json(record);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}
