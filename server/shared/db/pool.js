// shared/db/pool.js
import pkg from 'pg';
const { Pool } = pkg;

export const createPool = (config) => new Pool(config);
