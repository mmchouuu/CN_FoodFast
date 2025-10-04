const { v4: uuidv4 } = require('uuid');

module.exports = function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.id = id;
  // propagate as lowercase header for downstream libs if needed
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
};
