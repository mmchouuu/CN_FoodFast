const db = require('../db');
const pool = db?.default || db;

async function listRestaurants({ limit = 20, offset = 0, ownerId } = {}) {
  const values = [];
  let idx = 1;
  let query = 'SELECT * FROM restaurants';

  if (ownerId) {
    query += ` WHERE owner_id = $${idx++}`;
    values.push(ownerId);
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  values.push(limit, offset);

  const res = await pool.query(query, values);
  return res.rows;
}

async function getRestaurantById(id) {
  const res = await pool.query('SELECT * FROM restaurants WHERE id=$1', [id]);
  return res.rows[0] || null;
}

async function createRestaurant(data) {
  const {
    owner_id,
    name,
    description = null,
    cuisine = null,
    phone = null,
    email = null,
    images = [],
  } = data;

  const res = await pool.query(
    `INSERT INTO restaurants (owner_id, name, description, cuisine, phone, email, images)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      owner_id,
      name,
      description,
      cuisine,
      phone,
      email,
      Array.isArray(images) ? images : [images].filter(Boolean),
    ],
  );
  return res.rows[0];
}

async function updateRestaurant(id, data = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    owner_id: data.owner_id,
    name: data.name,
    description: Object.prototype.hasOwnProperty.call(data, 'description') ? data.description : undefined,
    cuisine: data.cuisine,
    phone: data.phone,
    email: data.email,
    images: data.images,
    is_active: Object.prototype.hasOwnProperty.call(data, 'is_active') ? Boolean(data.is_active) : undefined,
  };

  for (const [column, value] of Object.entries(mapping)) {
    if (typeof value === 'undefined') continue;

    if (column === 'images') {
      fields.push(`images = $${idx}`);
      values.push(Array.isArray(value) ? value : [value].filter(Boolean));
    } else {
      fields.push(`${column} = $${idx}`);
      values.push(value);
    }
    idx += 1;
  }

  if (!fields.length) {
    return getRestaurantById(id);
  }

  fields.push('updated_at = now()');
  const res = await pool.query(
    `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...values, id],
  );
  return res.rows[0] || null;
}

async function deleteRestaurant(id) {
  const res = await pool.query('DELETE FROM restaurants WHERE id=$1 RETURNING id', [id]);
  return res.rows[0] || null;
}

module.exports = {
  createRestaurant,
  listRestaurants,
  getRestaurantById,
  updateRestaurant,
  deleteRestaurant,
};
