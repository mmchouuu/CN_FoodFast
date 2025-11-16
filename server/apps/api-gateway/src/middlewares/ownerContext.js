const jwt = require('jsonwebtoken');
const restaurantClient = require('../services/restaurant.client');
const config = require('../config');

const JWT_SECRET = process.env.JWT_SECRET || config.jwtPublicKey || 'secret';

const parseScopeHeader = (value) => {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((entry) => entry.trim()).filter(Boolean);
};

async function attachOwnerContext(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let ownerId = null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      ownerId = payload.userId || payload.user_id || payload.id || payload.sub || null;
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

  req.ownerContext = {
    ownerId: String(ownerId),
    restaurantIds: Array.from(new Set(restaurantIds)),
  };

  return next();
}

module.exports = attachOwnerContext;
