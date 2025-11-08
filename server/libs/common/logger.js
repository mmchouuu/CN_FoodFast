<<<<<<< HEAD
// libs/common/logger.js
module.exports = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => { if (process.env.DEBUG) console.log('[DEBUG]', ...args); },
};
=======
// libs/common/logger.js
module.exports = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => { if (process.env.DEBUG) console.log('[DEBUG]', ...args); },
};
>>>>>>> e1903a6c2a79f913b83ae286c7238cad8b947f1d
