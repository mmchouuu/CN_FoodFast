// libs/common/logger.js
module.exports = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => { if (process.env.DEBUG) console.log('[DEBUG]', ...args); },
};
