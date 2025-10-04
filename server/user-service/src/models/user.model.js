const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function findByEmail(email){
  const res = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  return res.rows[0];
}

async function createUser({first_name,last_name,email,password_hash,phone,role}){
  const res = await pool.query(
    `INSERT INTO users (first_name,last_name,email,password_hash,phone,role)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [first_name,last_name,email,password_hash,phone,role || 'customer']
  );
  return res.rows[0];
}

async function findAll() {
  const r = await pool.query(
    'SELECT * FROM users ORDER BY id ASC'
  );
  return r.rows;
}

module.exports = { findByEmail, createUser, findAll };

