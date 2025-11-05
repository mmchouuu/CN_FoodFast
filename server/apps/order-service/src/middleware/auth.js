const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

module.exports = function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;

    const ownerHeader = req.headers['x-owner-id'];
    if (ownerHeader && !req.user.userId) {
      req.user.userId = ownerHeader;
    }

    const scopeHeader = req.headers['x-restaurant-ids'];
    if (scopeHeader) {
      const rawList = Array.isArray(scopeHeader)
        ? scopeHeader
        : String(scopeHeader)
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
      if (rawList.length) {
        req.user.restaurant_ids = rawList;
        req.user.restaurantIds = rawList;
        req.user.restaurants = rawList;
      }
    }

    return next();
  } catch (error) {
    console.error('[order-service] JWT verification failed:', error.message);
    return res.status(401).json({ error: 'invalid token' });
  }
};
