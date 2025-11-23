let logger;

try {
  // Attempt to reuse the shared logger when the libs directory exists
  logger = require('../../../libs/common/logger');
} catch (error) {
  // Fallback logger for container builds where the shared libs aren't available
  const write = (level, args) => {
    const fn =
      level === 'error'
        ? console.error
        : level === 'warn'
        ? console.warn
        : level === 'debug'
        ? console.debug || console.log
        : console.log;
    fn(`[delivery-service][${level.toUpperCase()}]`, ...args);
  };
  logger = {
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),
    debug: (...args) => {
      if (process.env.DEBUG) {
        write('debug', args);
      }
    },
  };
}

module.exports = logger;
