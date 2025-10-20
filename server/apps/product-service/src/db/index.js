const { Pool } = require('pg');

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pool = new Pool({
  host: process.env.DB_HOST || 'productdb',
  port: parseNumber(process.env.DB_PORT, 5432),
  database: process.env.DB_NAME || 'productdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  max: parseNumber(process.env.DB_POOL_MAX, 10),
  idleTimeoutMillis: parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000),
  connectionTimeoutMillis: parseNumber(process.env.DB_CONNECTION_TIMEOUT_MS, 10000),
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

pool.on('error', (error) => {
  console.error('[product-service] Unexpected database error:', error);
});

module.exports = pool;
