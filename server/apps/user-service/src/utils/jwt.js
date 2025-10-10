const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

module.exports = {
  sign(payload, opts = {}) {
    return jwt.sign(payload, JWT_SECRET, opts);
  },
  verify(token) {
    return jwt.verify(token, JWT_SECRET);
  }
};
