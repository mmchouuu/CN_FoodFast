// const { Pool } = require('pg');
// const config = require('../config');
// const pool = new Pool(config.DB);

// async function listProducts(limit=20, offset=0){
//   const res = await pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
//   return res.rows;
// }

// async function getProductById(id){
//   const res = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
//   return res.rows[0];
// }

// module.exports = { pool, listProducts, getProductById };

import pool from '../db/index.js';

export const ProductModel = {
  async getAll() {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    return result.rows;
  },

  async getById(id) {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return result.rows[0];
  },

  async create(product) {
    const { restaurant_id, title, description, images, category, type, base_price, popular } = product;
    const result = await pool.query(
      `INSERT INTO products (restaurant_id, title, description, images, category, type, base_price, popular)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [restaurant_id, title, description, images, category, type, base_price, popular]
    );
    return result.rows[0];
  },

  async update(id, product) {
    const { title, description, images, category, type, base_price, popular } = product;
    const result = await pool.query(
      `UPDATE products SET title=$1, description=$2, images=$3, category=$4, type=$5, base_price=$6, popular=$7, updated_at=now()
       WHERE id=$8 RETURNING *`,
      [title, description, images, category, type, base_price, popular, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return { message: 'Deleted successfully' };
  },
};
