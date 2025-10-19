import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'productdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'productdb',
});

export default pool;
