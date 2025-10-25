const pkg = require('pg');

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'productdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'productdb',
});

pool.on('error', (error) => {
  console.error('[product-service] Unexpected database error:', error);
});

module.exports = pool;
module.exports.default = pool;
module.exports.pool = pool;
