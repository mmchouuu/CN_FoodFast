const { Pool } = require('pg');
const config = require('../config');
const logger = require('../../../../libs/common/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
});

pool.on('error', (err) => {
  logger.error('[delivery-service] Unexpected database error:', err);
});

const query = (text, params) => pool.query(text, params);

const healthCheck = async () => {
  const result = await pool.query('SELECT NOW() AS current_time');
  return result.rows[0]?.current_time;
};

module.exports = {
  query,
  pool,
  healthCheck,
};
