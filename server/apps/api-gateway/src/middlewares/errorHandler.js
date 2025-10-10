module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const body = {
    message: err.message || 'Internal server error',
    requestId: req.id,
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    body.stack = err.stack;
  }
  res.status(status).json(body);
};
