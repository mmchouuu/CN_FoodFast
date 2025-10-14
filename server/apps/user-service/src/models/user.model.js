// models/user.model.js
const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function findByEmail(email){
  const res = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  return res.rows[0];
}

async function findById(id) {
  const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  return r.rows[0];
}

async function createUser({first_name, last_name, email, password_hash, phone, role='customer', otp_code=null, otp_expires=null, is_verified=false, is_approved=false}) {
  const res = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone, role, otp_code, otp_expires, is_verified, is_approved)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [first_name, last_name, email, password_hash, phone, role, otp_code, otp_expires, is_verified, is_approved]
  );
  return res.rows[0];
}

async function updateUser(id, fields = {}) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);
  const sets = keys.map((k, idx) => `${k}=$${idx+1}`).join(', ');
  const vals = keys.map(k => fields[k]);
  vals.push(id);
  const r = await pool.query(`UPDATE users SET ${sets}, updated_at=now() WHERE id=$${vals.length} RETURNING *`, vals);
  return r.rows[0];
}

async function verifyUser(email) {
  await pool.query(
    `UPDATE users SET is_verified=true, otp_code=NULL, otp_expires=NULL WHERE email=$1`,
    [email]
  );
}

async function approveUserByEmail(email) {
  await pool.query(
    `UPDATE users SET is_approved = true WHERE email = $1`,
    [email]
  );
}

async function approveUserById(id) {
  await pool.query('UPDATE users SET is_approved = true WHERE id = $1', [id]);
}

async function getAll() {
  const r = await pool.query('SELECT * FROM users ORDER BY id ASC');
  return r.rows;
}

module.exports = { findByEmail, findById, createUser, updateUser, verifyUser, approveUserByEmail, approveUserById, getAll };
