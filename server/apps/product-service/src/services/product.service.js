// const model = require('../models/product.model');

// async function list({limit, offset}) {
//   return model.listProducts(limit, offset);
// }
// async function get(id) {
//   return model.getProductById(id);
// }
// module.exports = { list, get };



// import pool from "../db/index.js";

// export async function createProduct(data) {
//   const { restaurant_id, title, description, category, base_price, images, type, popular } = data;

//   const query = `
//     INSERT INTO products (
//       restaurant_id, title, description, category, base_price, images, type, popular
//     )
//     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
//     RETURNING *;
//   `;

//   const values = [
//     restaurant_id,
//     title,
//     description || null,
//     category || null,
//     base_price || 0,
//     images || [],
//     type || null,
//     popular || false
//   ];

//   const { rows } = await pool.query(query, values);
//   return rows[0];
// }



// src/services/product.service.js
import pool from "../db/index.js";

// Lấy tất cả sản phẩm
export const getAllProducts = async () => {
  const result = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
  return result.rows;
};

// Lấy sản phẩm theo ID
export const getProductById = async (id) => {
  const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
  return result.rows[0];
};

// Tạo sản phẩm mới
export const createProduct = async (product) => {
  const {
    restaurant_id,
    title,
    description,
    images,
    category,
    type,
    base_price,
    popular,
  } = product;

  const result = await pool.query(
    `INSERT INTO products (
      restaurant_id, title, description, images, category, type, base_price, popular
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [restaurant_id, title, description, images, category, type, base_price, popular]
  );

  return result.rows[0];
};

// Cập nhật sản phẩm
export const updateProduct = async (id, product) => {
  const {
    title,
    description,
    images,
    category,
    type,
    base_price,
    popular,
  } = product;

  const result = await pool.query(
    `UPDATE products
     SET title=$1, description=$2, images=$3, category=$4, type=$5,
         base_price=$6, popular=$7, updated_at=now()
     WHERE id=$8
     RETURNING *`,
    [title, description, images, category, type, base_price, popular, id]
  );

  return result.rows[0];
};

// Xóa sản phẩm
export const deleteProduct = async (id) => {
  await pool.query("DELETE FROM products WHERE id = $1", [id]);
};
