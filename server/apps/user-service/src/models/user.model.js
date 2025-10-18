// models/user.model.js
const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function findByEmail(email){
  const res = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  );
  return res.rows[0];
}

async function findById(id) {
  const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  return r.rows[0];
}

async function createUser({
  first_name,
  last_name,
  email,
  password_hash = null,
  phone,
  role = 'customer',
  is_active = role === 'customer',
  otp_code = null,
  otp_expires = null,
  is_verified = false,
  is_approved = false,
  email_verified = false,
  tier = 'Bronze',
  restaurant_name = null,
  company_address = null,
  tax_code = null,
  manager_name = null,
  restaurant_status = role === 'restaurant' ? 'pending' : null,
}) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;
  const res = await pool.query(
    `INSERT INTO users (
        first_name,
        last_name,
        email,
        password_hash,
        phone,
        role,
        is_active,
        otp_code,
        otp_expires,
        is_verified,
        is_approved,
        email_verified,
        tier,
        restaurant_name,
        company_address,
        tax_code,
        manager_name,
        restaurant_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [
      first_name,
      last_name,
      normalizedEmail,
      password_hash,
      phone,
      role,
      is_active,
      otp_code,
      otp_expires,
      is_verified,
      is_approved,
      email_verified,
      tier,
      restaurant_name,
      company_address,
      tax_code,
      manager_name,
      restaurant_status,
    ]
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
    `UPDATE users
     SET is_verified=true, otp_code=NULL, otp_expires=NULL
     WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
}

async function approveUserByEmail(email) {
  await pool.query(
    `UPDATE users SET is_approved = true WHERE LOWER(email) = LOWER($1)`,
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

async function listByRole(role) {
  const r = await pool.query(
    `SELECT id,
            first_name,
            last_name,
            email,
            phone,
            role,
            is_active,
            is_verified,
            is_approved,
            email_verified,
            restaurant_name,
            restaurant_status,
            created_at,
            updated_at
     FROM users
     WHERE role = $1
     ORDER BY created_at DESC`,
    [role]
  );
  return r.rows;
}

async function setActiveStatus(id, isActive) {
  const r = await pool.query(
    'UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [isActive, id]
  );
  return r.rows[0];
}

async function getAddressesByUserId(userId) {
  const r = await pool.query(
    `SELECT id, street, ward, district, city, is_primary, label, created_at, updated_at
     FROM user_addresses
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return r.rows;
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateUser,
  verifyUser,
  approveUserByEmail,
  approveUserById,
  getAll,
  listByRole,
  setActiveStatus,
  getAddressesByUserId,
};
