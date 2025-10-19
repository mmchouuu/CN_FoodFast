const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

async function createOrderWithItems(orderPayload, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, restaurant_id, branch_id, status, payment_status, total_amount, currency, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        orderPayload.user_id,
        orderPayload.restaurant_id,
        orderPayload.branch_id,
        orderPayload.status,
        orderPayload.payment_status,
        orderPayload.total_amount,
        orderPayload.currency,
        orderPayload.metadata || {},
      ],
    );
    const order = orderRes.rows[0];

    const insertedItems = [];
    for (const item of items) {
      const itemRes = await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_snapshot, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          order.id,
          item.product_id,
          item.variant_id,
          item.product_snapshot || {},
          item.quantity,
          item.unit_price,
          item.total_price,
        ],
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');
    order.items = insertedItems;
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getOrderWithItems(orderId) {
  const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [
    orderId,
  ]);
  const order = orderRes.rows[0];
  if (!order) return null;
  const itemsRes = await pool.query(
    'SELECT * FROM order_items WHERE order_id = $1',
    [orderId],
  );
  order.items = itemsRes.rows;
  return order;
}

async function getOrderForUser(orderId, userId) {
  const orderRes = await pool.query(
    'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId],
  );
  const order = orderRes.rows[0];
  if (!order) return null;
  const itemsRes = await pool.query(
    'SELECT * FROM order_items WHERE order_id = $1',
    [orderId],
  );
  order.items = itemsRes.rows;
  return order;
}

async function listOrdersByUser(userId) {
  const ordersRes = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  const orders = ordersRes.rows;
  if (!orders.length) return [];

  const ids = orders.map((order) => order.id);
  const itemsRes = await pool.query(
    'SELECT * FROM order_items WHERE order_id = ANY($1::uuid[])',
    [ids],
  );

  const itemsByOrder = new Map();
  for (const item of itemsRes.rows) {
    const list = itemsByOrder.get(item.order_id) || [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
  }));
}

module.exports = {
  pool,
  createOrderWithItems,
  getOrderWithItems,
  getOrderForUser,
  listOrdersByUser,
};
