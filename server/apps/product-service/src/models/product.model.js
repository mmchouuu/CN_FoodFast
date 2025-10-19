// db/products.js
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool(config.DB);

async function listProducts({ limit = 20, offset = 0, restaurantId } = {}) {
  const values = [];
  let idx = 1;

  let query = 'SELECT * FROM products';

  if (restaurantId) {
    query += ' WHERE restaurant_id = $' + idx;
    values.push(restaurantId);
    idx += 1;
  }

  query += ' ORDER BY created_at DESC';
  query += ' LIMIT $' + idx + ' OFFSET $' + (idx + 1);
  values.push(Number(limit) || 20, Number(offset) || 0);

  const res = await pool.query(query, values);
  return res.rows;
}

async function getProductById(id) {
  const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
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

  const imagesArray = Array.isArray(images) ? images : [images].filter(Boolean);

  const res = await pool.query(
    `INSERT INTO products (
       restaurant_id, title, description, images, category, type, base_price, popular
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      restaurant_id,
      title,
      description,
      imagesArray,
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

  // mapping các field cho phép update (nếu không truyền thì bỏ qua)
  const mapping = {
    restaurant_id: data.restaurant_id,
    title: data.title,
    // cho phép set description = null (phân biệt với undefined)
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
      const imagesArray = Array.isArray(value) ? value : [value].filter(Boolean);
      fields.push(`images = $${idx}`);
      values.push(imagesArray);
      idx += 1;
    } else {
      fields.push(`${column} = $${idx}`);
      values.push(value);
      idx += 1;
    }
  }

  // Không có gì để update -> trả về bản ghi hiện tại
  if (!fields.length) {
    return getProductById(id);
  }

  // cập nhật updated_at = NOW() mà không cần placeholder
  fields.push('updated_at = NOW()');

  const query = `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const res = await pool.query(query, [...values, id]);
  return res.rows[0] || null;
}

async function deleteProduct(id) {
  const res = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
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
