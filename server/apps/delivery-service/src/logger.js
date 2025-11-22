let logger;

try {
  // Attempt to reuse the shared logger when the libs directory exists
  logger = require('../../../libs/common/logger');
} catch (error) {
  // Fallback logger for container builds where the shared libs aren't available
  const format = (level, args) => console[level === 'error' ? 'error' : 'log'](`[delivery-service][${level.toUpperCase()}]`, ...args);
  logger = {
    info: (...args) => format('info', args),
    error: (...args) => format('error', args),
    debug: (...args) => {
      if (process.env.DEBUG) {
        format('debug', args);
      }
    },
  };
}

module.exports = logger;
