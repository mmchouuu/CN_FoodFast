import * as service from '../services/product.service.js';

function handleServiceError(err, res, next) {
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return next(err);
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalised)) return true;
    if (['false', '0', 'no', 'n'].includes(normalised)) return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return undefined;
}

function buildPayload(body = {}) {
  const payload = { ...body };

  const basePrice = parseNumeric(payload.base_price ?? payload.basePrice);
  if (typeof basePrice !== 'undefined') {
    payload.base_price = basePrice;
  } else {
    delete payload.base_price;
  }

  const taxRate = parseNumeric(payload.tax_rate ?? payload.taxRate);
  if (typeof taxRate !== 'undefined') {
    payload.tax_rate = taxRate;
  } else {
    delete payload.tax_rate;
  }

  const popular = parseBoolean(payload.popular);
  if (typeof popular !== 'undefined') {
    payload.popular = popular;
  }

  const isActive = parseBoolean(payload.is_active);
  if (typeof isActive !== 'undefined') {
    payload.is_active = isActive;
  }

  const available = parseBoolean(payload.available);
  if (typeof available !== 'undefined') {
    payload.available = available;
  }

  return payload;
}

export async function list(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || 20, 10);
    const offset = parseInt(req.query.offset || 0, 10);
    const params = { limit, offset };
    const restaurantId = req.params?.restaurantId || req.query.restaurant_id;
    if (restaurantId) {
      params.restaurantId = restaurantId;
    }
    const rows = await service.list(params);
    res.json({ data: rows });
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function get(req, res, next) {
  try {
    const restaurantId = req.params?.restaurantId;
    const product = await service.get(req.params.id, {
      expectedRestaurantId: restaurantId,
    });
    if (!product) return res.status(404).json({ error: 'not found' });
    res.json(product);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function create(req, res, next) {
  try {
    const payload = buildPayload(req.body);
    const restaurantFromParams = req.params?.restaurantId;
    if (restaurantFromParams) {
      payload.restaurant_id = restaurantFromParams;
    }
    const { restaurant_id: restaurantId, title } = payload;
    if (!restaurantId || !title) {
      return res
        .status(400)
        .json({ error: 'restaurant_id and title are required' });
    }
    const created = await service.create(payload);
    res.status(201).json(created);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function update(req, res, next) {
  try {
    const restaurantId = req.params?.restaurantId;
    const payload = buildPayload(req.body);
    const updated = await service.update(req.params.id, payload, {
      expectedRestaurantId: restaurantId,
    });
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function remove(req, res, next) {
  try {
    const restaurantId = req.params?.restaurantId;
    const deleted = await service.remove(req.params.id, {
      expectedRestaurantId: restaurantId,
    });
    if (!deleted) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function listCategories(req, res, next) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const params = {
      search: req.query.search,
      restaurantId:
        req.params?.restaurantId ||
        req.query?.restaurant_id ||
        req.query?.restaurantId ||
        null,
      limit,
      offset,
    };
    const data = await service.listCategories(params);
    res.json({ data });
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function createCategory(req, res, next) {
  try {
    const payload = req.body || {};
    if (!payload.name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const created = await service.createCategory(payload);
    res.status(201).json(created);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const id = req.params.categoryId || req.params.id;
    const updated = await service.updateCategory(id, req.body || {});
    res.json(updated);
  } catch (err) {
    handleServiceError(err, res, next);
  }
}

export async function removeCategory(req, res, next) {
  try {
    const id = req.params.categoryId || req.params.id;
    const removed = await service.removeCategory(id);
    if (!removed) {
      return res.status(404).json({ error: 'not found' });
    }
    res.status(204).end();
  } catch (err) {
    handleServiceError(err, res, next);
  }
}
