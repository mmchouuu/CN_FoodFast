<<<<<<< HEAD
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.DB);

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  withTransaction,
};
=======
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.DB);

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  withTransaction,
};
>>>>>>> e1903a6c2a79f913b83ae286c7238cad8b947f1d
