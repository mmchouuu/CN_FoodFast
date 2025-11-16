const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const parseScopeHeader = (headerValue) => {
  return ensureArray(headerValue)
    .map((value) => String(value).split(','))
    .flat()
    .map((value) => value.trim())
    .filter(Boolean);
};

const applyScopeFromHeaders = (req, user) => {
  const scopeList = parseScopeHeader(req.headers['x-restaurant-ids']);
  if (scopeList.length && user) {
    user.restaurant_ids = scopeList;
    user.restaurantIds = scopeList;
    user.restaurants = scopeList;
  }

  const branchScope = parseScopeHeader(req.headers['x-branch-ids']);
  if (branchScope.length && user) {
    user.branch_ids = branchScope;
    user.branchIds = branchScope;
    user.managed_branches = branchScope;
    user.managedBranches = branchScope;
  }
};

const buildUserFromHeaders = (req) => {
  const ownerHeader =
    req.headers['x-owner-id'] || req.query?.ownerId || req.body?.ownerId;
  if (ownerHeader) {
    return { userId: String(ownerHeader).trim(), role: 'owner' };
  }

  const userHeader =
    req.headers['x-user-id'] ||
    req.headers['x-customer-id'] ||
    req.query?.userId ||
    req.query?.customerId ||
    req.body?.userId ||
    req.body?.customerId;
  if (userHeader) {
    return {
      userId: String(userHeader).trim(),
      role:
        req.headers['x-user-role'] ||
        (req.headers['x-customer-id'] ? 'customer' : null) ||
        'customer',
    };
  }

  return null;
};

module.exports = function authenticate(req, res, next) {
  const headerUser = buildUserFromHeaders(req);
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    if (headerUser && headerUser.userId) {
      req.user = headerUser;
      applyScopeFromHeaders(req, req.user);
      return next();
    }
    return res.status(401).json({ error: 'missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload || {};

    if (headerUser && headerUser.userId) {
      req.user.userId = headerUser.userId;
      if (!req.user.role) {
        req.user.role = headerUser.role;
      }
    }

    applyScopeFromHeaders(req, req.user);
    return next();
  } catch (error) {
    console.error('[order-service] JWT verification failed:', error.message);
    if (headerUser && headerUser.userId) {
      req.user = headerUser;
      applyScopeFromHeaders(req, req.user);
      return next();
    }
    return res.status(401).json({ error: 'invalid token' });
  }
};
