module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const body = {
    message: err.message || 'Internal server error',
    requestId: req.id,
  };

  // If a downstream service returned a JSON body, expose a safe subset for debugging
  if (err.data && typeof err.data === 'object') {
    // Common fields we allow to pass through
    const { message, code, details, errors } = err.data;
    body.downstream = {};
    if (message) body.downstream.message = message;
    if (code) body.downstream.code = code;
    if (details) body.downstream.details = details;
    if (errors) body.downstream.errors = errors;
  }

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    body.stack = err.stack;
  }

  // Basic server-side log for tracing
  // eslint-disable-next-line no-console
  console.error(`[gateway] ${req.method} ${req.originalUrl} -> ${status}`, {
    requestId: req.id,
    error: err.message,
    downstream: err.data && typeof err.data === 'object' ? err.data : undefined,
  });

  res.status(status).json(body);
};
