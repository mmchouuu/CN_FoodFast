const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ error: 'no token' });
  const token = h.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) { return res.status(401).json({ error: 'invalid token' }); }
}

module.exports = { authMiddleware };