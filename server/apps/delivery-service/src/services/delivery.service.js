const db = require('../db');
const logger = require('../../../../libs/common/logger');

const parseLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 100);
};

async function listDeliveries({ limit } = {}) {
  // Placeholder logic until delivery tables are ready.
  const safeLimit = parseLimit(limit);
  if (logger.debug) {
    logger.debug('[delivery-service] listDeliveries invoked with limit:', safeLimit);
  }
  return {
    items: [],
    limit: safeLimit,
    total: 0,
  };
}

async function getSystemStatus() {
  try {
    const timestamp = await db.healthCheck();
    return {
      database: 'ok',
      timestamp,
    };
  } catch (error) {
    logger.error('[delivery-service] Database health check failed:', error);
    return {
      database: 'error',
      error: error.message,
    };
  }
}

module.exports = {
  listDeliveries,
  getSystemStatus,
};
