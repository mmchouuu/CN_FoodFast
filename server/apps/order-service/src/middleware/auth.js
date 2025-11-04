const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

const firstTruthyString = (...candidates) => {
  for (const value of candidates) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str.length) {
      return str;
    }
  }
  return null;
};

const parseList = (value) => {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === undefined || item === null ? null : String(item).trim()))
      .filter((item) => item && item.length);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (item === undefined || item === null ? null : String(item).trim()))
          .filter((item) => item && item.length);
      }
    } catch (error) {
      // ignore JSON parsing errors, fall through to comma split
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
};

const parseRoles = (...sources) => {
  const collected = [];
  sources.forEach((value) => {
    collected.push(...parseList(value));
  });
  return Array.from(
    new Set(
      collected
        .map((role) => role.toLowerCase())
        .filter((role) => role.length),
    ),
  );
};

const parseIds = (...sources) => {
  const collected = [];
  sources.forEach((value) => {
    collected.push(...parseList(value));
  });
  return Array.from(new Set(collected));
};

module.exports = function authenticate(req, res, next) {
  const directUserId = firstTruthyString(
    req.headers['x-user-id'],
    req.body?.user_id,
    req.body?.userId,
    req.query?.user_id,
    req.query?.userId,
  );

  if (directUserId) {
    const resolvedRoles = parseRoles(
      req.headers['x-user-role'],
      req.headers['x-user-roles'],
      req.body?.role,
      req.body?.roles,
      req.query?.role,
      req.query?.roles,
    );

    const primaryRole = resolvedRoles.length ? resolvedRoles[0] : 'customer';

    const restaurantIds = parseIds(
      req.headers['x-restaurant-ids'],
      req.body?.restaurant_ids,
      req.body?.restaurantIds,
      req.query?.restaurant_ids,
      req.query?.restaurantIds,
    );

    const branchIds = parseIds(
      req.headers['x-branch-ids'],
      req.body?.branch_ids,
      req.body?.branchIds,
      req.query?.branch_ids,
      req.query?.branchIds,
    );

    const user = {
      id: directUserId,
      userId: directUserId,
      role: primaryRole,
    };

    if (resolvedRoles.length) {
      user.roles = resolvedRoles;
    }

    if (req.body?.permissions || req.headers['x-user-permissions']) {
      user.permissions = parseRoles(req.body?.permissions, req.headers['x-user-permissions']);
    }

    if (restaurantIds.length) {
      user.restaurant_ids = restaurantIds;
      user.restaurantIds = restaurantIds;
    }

    if (branchIds.length) {
      user.branch_ids = branchIds;
      user.branchIds = branchIds;
    }

    if (req.body?.name || req.headers['x-user-name']) {
      user.name = firstTruthyString(req.body?.name, req.headers['x-user-name']);
    }

    if (req.body?.email || req.headers['x-user-email']) {
      user.email = firstTruthyString(req.body?.email, req.headers['x-user-email']);
    }

    req.user = user;
    return next();
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    console.error('[order-service] JWT verification failed:', error.message);
    return res.status(401).json({ error: 'invalid token' });
  }
};
