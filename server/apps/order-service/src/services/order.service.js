// const model = require('../models/order.model');

// async function create(payload) {
//   // payload validation omitted for brevity
//   return model.createOrder(payload);
// }
// async function get(id) {
//   return model.getOrder(id);
// }
// module.exports = { create, get };

import pool from "../db/index.js";

// ========== ORDERS ==========
export const getAllOrders = async () => {
  const result = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
  return result.rows;
};

export const getOrderById = async (id) => {
  const result = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
  if (result.rows.length === 0) return null;

  const items = await pool.query("SELECT * FROM order_items WHERE order_id = $1", [id]);
  const delivery = await pool.query("SELECT * FROM deliveries WHERE order_id = $1", [id]);
  const events = await pool.query("SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at", [id]);

  return {
    ...result.rows[0],
    items: items.rows,
    delivery: delivery.rows[0] || null,
    events: events.rows,
  };
};

export const createOrder = async (orderData) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      user_id,
      restaurant_id,
      branch_id,
      total_amount,
      metadata,
      payment_status = "unpaid",
      status = "pending",
      order_items = [],
      delivery = null,
    } = orderData;

    // Insert order
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, restaurant_id, branch_id, total_amount, metadata, payment_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, restaurant_id, branch_id, total_amount, metadata, payment_status, status]
    );

    const order = orderRes.rows[0];

    // Insert order items
    for (const item of order_items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_snapshot, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.product_id,
          item.variant_id,
          item.product_snapshot,
          item.quantity,
          item.unit_price,
          item.total_price,
        ]
      );
    }

    // Insert delivery info (optional)
    if (delivery) {
      await client.query(
        `INSERT INTO deliveries (order_id, delivery_address, delivery_status, estimated_at)
         VALUES ($1, $2, $3, $4)`,
        [order.id, delivery.delivery_address, delivery.delivery_status || "preparing", delivery.estimated_at]
      );
    }

    // Insert event (order_created)
    await client.query(
      `INSERT INTO order_events (order_id, event_type, payload)
       VALUES ($1, $2, $3)`,
      [order.id, "ORDER_CREATED", { order_id: order.id, total_amount }]
    );

    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const updateOrderStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );

  if (result.rows.length === 0) return null;

  // Lưu event
  await pool.query(
    `INSERT INTO order_events (order_id, event_type, payload)
     VALUES ($1, $2, $3)`,
    [id, "STATUS_UPDATED", { new_status: status }]
  );

  return result.rows[0];
};

export const deleteOrder = async (id) => {
  await pool.query("DELETE FROM orders WHERE id = $1", [id]);
  return { message: "Order deleted successfully" };
};
