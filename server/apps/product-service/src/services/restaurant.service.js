import pool from '../db/index.js';

// Lấy toàn bộ danh sách nhà hàng
export async function getAllRestaurants() {
  const { rows } = await pool.query('SELECT * FROM restaurants ORDER BY created_at DESC');
  return rows;
}

// Lấy chi tiết 1 nhà hàng theo id
export async function getRestaurantById(id) {
  const { rows } = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
  return rows[0];
}

// Tạo nhà hàng mới
export async function createRestaurant(data) {
  const { name, description, phone, email, cuisine } = data;
  const query = `
    INSERT INTO restaurants (name, description, phone, email, cuisine)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [name, description, phone, email, cuisine];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

// Cập nhật nhà hàng
export async function updateRestaurant(id, data) {
  const { name, description, phone, email, cuisine, is_open } = data;
  const query = `
    UPDATE restaurants
    SET name = $1, description = $2, phone = $3, email = $4, cuisine = $5, is_open = $6, updated_at = now()
    WHERE id = $7
    RETURNING *;
  `;
  const values = [name, description, phone, email, cuisine, is_open, id];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

// Xóa nhà hàng
export async function deleteRestaurant(id) {
  await pool.query('DELETE FROM restaurants WHERE id = $1', [id]);
  return { message: 'Restaurant deleted successfully' };
}
