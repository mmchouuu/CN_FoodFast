const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function listProducts({ limit = 20, offset = 0, restaurantId } = {}) {
  const values = [];
  let idx = 1;
  let query = 'SELECT * FROM products';

  if (restaurantId) {
    query += ` WHERE restaurant_id = $${idx++}`;
    values.push(restaurantId);
  }

  query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  values.push(limit, offset);

  const res = await pool.query(query, values);
  return res.rows;
}

async function getProductById(id) {
  const res = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
  return res.rows[0] || null;
}

async function createProduct(data) {
  const {
    restaurant_id,
    title,
    description = null,
    images = [],
    category = null,
    type = null,
    base_price = 0,
    popular = false,
  } = data;

  const res = await pool.query(
    `INSERT INTO products (restaurant_id, title, description, images, category, type, base_price, popular)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      restaurant_id,
      title,
      description,
      Array.isArray(images) ? images : [images].filter(Boolean),
      category,
      type,
      Number(base_price) || 0,
      Boolean(popular),
    ],
  );
  return res.rows[0];
}

async function updateProduct(id, data = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    restaurant_id: data.restaurant_id,
    title: data.title,
    description: Object.prototype.hasOwnProperty.call(data, 'description') ? data.description : undefined,
    images: data.images,
    category: data.category,
    type: data.type,
    base_price: Object.prototype.hasOwnProperty.call(data, 'base_price') ? Number(data.base_price) : undefined,
    popular: Object.prototype.hasOwnProperty.call(data, 'popular') ? Boolean(data.popular) : undefined,
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
    return getProductById(id);
  }

  fields.push(`updated_at = now()`);
  const res = await pool.query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...values, id],
  );
  return res.rows[0] || null;
}

async function deleteProduct(id) {
  const res = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [id]);
  return res.rows[0] || null;
}

module.exports = {
  pool,
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
