const jwt = require('jsonwebtoken');
const restaurantClient = require('../services/restaurant.client');
const config = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || config.jwtPublicKey || 'secret';

const parseScopeHeader = (value) => {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((entry) => entry.trim()).filter(Boolean);
};

const scopeFromPayload = (payload, keys = []) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const values = [];
  keys.forEach((key) => {
    if (Array.isArray(payload[key])) {
      values.push(...payload[key]);
    } else if (payload[key]) {
      values.push(payload[key]);
    }
  });
  if (Array.isArray(payload.scope)) {
    values.push(
      ...payload.scope
        .map((entry) => {
          if (!entry) return null;
          if (keys.includes('restaurantId') || keys.includes('restaurant_id')) {
            return entry.restaurantId || entry.restaurant_id || null;
          }
          if (keys.includes('branchId') || keys.includes('branch_id')) {
            return entry.branchId || entry.branch_id || null;
          }
          return null;
        })
        .filter(Boolean),
    );
  }
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length);
};

async function attachOwnerContext(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let ownerId = null;
  let payload = null;
  if (token) {
    try {
      payload = jwt.verify(token, JWT_SECRET);
      ownerId =
        payload.userId ||
        payload.user_id ||
        payload.sub ||
        payload.restaurantAccountId ||
        payload.accountId ||
        payload.id ||
        null;
    } catch (error) {
      if (!req.headers['x-owner-id']) {
        return res.status(401).json({ error: 'invalid token' });
      }
    }
  }

  if (!ownerId) {
    ownerId =
      req.headers['x-owner-id'] ||
      req.query?.ownerId ||
      req.body?.ownerId ||
      null;
  }

  if (!ownerId) {
    return res.status(401).json({ error: 'owner identity required' });
  }

  let restaurantIds = parseScopeHeader(req.headers['x-restaurant-ids']);
  if (!restaurantIds.length && payload) {
    restaurantIds = scopeFromPayload(payload, [
      'restaurantIds',
      'restaurant_ids',
      'restaurants',
      'restaurantId',
      'restaurant_id',
    ]);
  }
  if (!restaurantIds.length && payload?.restaurantId) {
    restaurantIds = [String(payload.restaurantId)];
  }

  if (!restaurantIds.length) {
    try {
      const response = await restaurantClient.listRestaurantsByOwner(ownerId, {
        headers: { 'x-request-id': req.id },
      });
      const items = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : [];
      restaurantIds = items
        .map((item) => item?.id || item?.restaurant_id)
        .filter(Boolean)
        .map((value) => String(value));
    } catch (error) {
      console.error('[gateway → owner context] failed to resolve restaurants:', error.message);
      return res.status(502).json({ error: 'failed to resolve owner restaurant scope' });
    }
  }

  const branchIds =
    scopeFromPayload(payload, ['branchIds', 'branch_ids', 'branchId', 'branch_id']) ||
    parseScopeHeader(req.headers['x-branch-ids']);

  req.ownerContext = {
    ownerId: String(ownerId),
    restaurantIds: Array.from(new Set(restaurantIds)),
    branchIds: Array.from(new Set(branchIds || [])),
  };

  return next();
}

module.exports = attachOwnerContext;
