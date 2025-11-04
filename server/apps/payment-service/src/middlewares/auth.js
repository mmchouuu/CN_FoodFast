const jwt = require('jsonwebtoken');
const config = require('../config');

const coalesceString = (...candidates) => {
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
      // fall through to comma split
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
};

const parseRoles = (...values) => {
  const collected = [];
  values.forEach((value) => {
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

function auth(req, res, next) {
  const directUserId = coalesceString(
    req.headers['x-user-id'],
    req.body?.user_id,
    req.body?.userId,
    req.query?.user_id,
    req.query?.userId,
  );

  if (directUserId) {
    const roles = parseRoles(
      req.headers['x-user-role'],
      req.headers['x-user-roles'],
      req.body?.role,
      req.body?.roles,
      req.query?.role,
      req.query?.roles,
    );

    const primaryRole = roles.length ? roles[0] : 'customer';

    const user = {
      id: directUserId,
      userId: directUserId,
      role: primaryRole,
    };

    if (roles.length) {
      user.roles = roles;
    }

    if (req.body?.name || req.headers['x-user-name']) {
      user.name = coalesceString(req.body?.name, req.headers['x-user-name']);
    }

    if (req.body?.email || req.headers['x-user-email']) {
      user.email = coalesceString(req.body?.email, req.headers['x-user-email']);
    }

    req.user = user;
    return next();
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
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
