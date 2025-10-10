const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function findByEmail(email){
  const res = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  return res.rows[0];
}

async function createUser({first_name, last_name, email, password_hash, phone, role, otp_code, is_verified}) {
  const res = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone, role, otp_code, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [first_name, last_name, email, password_hash, phone, role || 'customer', otp_code, is_verified || false]
  );
  return res.rows[0];
}


async function verifyUser(email) {
  await pool.query(
    `UPDATE users SET is_verified=true, otp_code=NULL WHERE email=$1`,
    [email]
  );
}


async function getAll() {
  const r = await pool.query(
    'SELECT * FROM users ORDER BY id ASC'
  );
  return r.rows;
}


module.exports = { findByEmail, createUser, verifyUser, getAll };

