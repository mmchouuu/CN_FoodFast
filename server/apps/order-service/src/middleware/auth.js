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
    return next();
  } catch (error) {
    console.error('[order-service] JWT verification failed:', error.message);
    return res.status(401).json({ error: 'invalid token' });
  }
};
