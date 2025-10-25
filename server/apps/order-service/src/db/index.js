const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  host: config.DB.host,
  port: config.DB.port,
  database: config.DB.database,
  user: config.DB.user,
  password: config.DB.password,
  ssl: config.DB.ssl,
  max: config.DB.max,
  idleTimeoutMillis: config.DB.idleTimeoutMillis,
  connectionTimeoutMillis: config.DB.connectionTimeoutMillis,
});

pool.on('error', (error) => {
  console.error('[order-service] Unexpected database error:', error);
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
};
