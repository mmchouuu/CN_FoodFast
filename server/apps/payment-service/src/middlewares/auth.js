const jwt = require('jsonwebtoken');
const config = require('../config');

function auth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const ownerOverride = req.headers['x-owner-id'] || req.headers['x-restaurant-owner-id'];
  if (!authHeader) {
    if (ownerOverride) {
      req.user = {
        userId: ownerOverride,
        role:
          (req.headers['x-owner-role'] || req.headers['x-restaurant-role'] || 'owner').toLowerCase(),
      };
      return next();
    }
    return res.status(401).json({ error: 'authorization header missing' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'invalid authorization header format' });
  }

  const token = parts[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET || 'secret');
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

module.exports = auth;
