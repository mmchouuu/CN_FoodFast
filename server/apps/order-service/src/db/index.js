// src/db/index.js
import { createPool } from '@foodfast/shared/db/pool.js';

const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

export default pool;
