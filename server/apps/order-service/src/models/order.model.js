const { Pool } = require('pg');
const config = require('../config');
const pool = new Pool(config.DB);

function serializeDeliveryAddress(address) {
  if (address == null) return null;
  if (typeof address === 'string') {
    return address;
  }
  try {
    return JSON.stringify(address);
  } catch {
    return String(address);
  }
}

function parseDeliveryRow(row) {
  if (!row) return null;
  let parsedAddress = row.delivery_address;
  if (typeof parsedAddress === 'string') {
    try {
      parsedAddress = JSON.parse(parsedAddress);
    } catch {
      parsedAddress = { formatted: parsedAddress };
    }
  }
  return {
    id: row.id,
    order_id: row.order_id,
    delivery_status: row.delivery_status,
    delivery_address: parsedAddress,
    estimated_at: row.estimated_at,
    delivered_at: row.delivered_at,
    proof: row.proof,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createOrderWithItems(orderPayload, items, options = {}) {
  const { deliveryAddress = null } = options || {};
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

    let deliveryRecord = null;
    if (deliveryAddress) {
      const deliveryStatus =
        deliveryAddress.delivery_status ||
        deliveryAddress.status ||
        'preparing';
      const serializedAddress = serializeDeliveryAddress(deliveryAddress);
      const deliveryRes = await client.query(
        `INSERT INTO deliveries (order_id, delivery_address, delivery_status)
         VALUES ($1,$2,$3) RETURNING *`,
        [order.id, serializedAddress, deliveryStatus],
      );
      deliveryRecord = parseDeliveryRow(deliveryRes.rows[0]);
    }

    await client.query('COMMIT');
    order.items = insertedItems;
    order.delivery = deliveryRecord;
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
  const deliveryRes = await pool.query(
    `SELECT * FROM deliveries WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
  order.delivery = parseDeliveryRow(deliveryRes.rows[0]);
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
  const deliveryRes = await pool.query(
    `SELECT * FROM deliveries WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
  order.delivery = parseDeliveryRow(deliveryRes.rows[0]);
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

  const deliveriesRes = await pool.query(
    `SELECT DISTINCT ON (order_id) * FROM deliveries
     WHERE order_id = ANY($1::uuid[])
     ORDER BY order_id, created_at DESC`,
    [ids],
  );

  const deliveriesByOrder = new Map();
  for (const delivery of deliveriesRes.rows) {
    deliveriesByOrder.set(delivery.order_id, parseDeliveryRow(delivery));
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) || [],
    delivery: deliveriesByOrder.get(order.id) || null,
  }));
}

async function updatePaymentForUser(orderId, userId, updates = {}) {
  const existingRes = await pool.query(
    'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId],
  );
  const existing = existingRes.rows[0];
  if (!existing) return null;

  const metadataBase =
    existing.metadata && typeof existing.metadata === 'object'
      ? { ...existing.metadata }
      : {};
  const paymentMetaBase =
    metadataBase.payment && typeof metadataBase.payment === 'object'
      ? { ...metadataBase.payment }
      : {};

  const paymentMeta = { ...paymentMetaBase };

  if (updates.method !== undefined) paymentMeta.method = updates.method;
  if (updates.reference !== undefined) paymentMeta.reference = updates.reference;
  if (updates.transaction_id !== undefined) {
    paymentMeta.transaction_id = updates.transaction_id;
  }
  if (updates.paid_at !== undefined) paymentMeta.paid_at = updates.paid_at;
  if (updates.amount !== undefined && updates.amount !== null) {
    paymentMeta.amount = updates.amount;
  }
  if (updates.currency) paymentMeta.currency = updates.currency;

  const metadataPatch =
    updates.metadata && typeof updates.metadata === 'object'
      ? updates.metadata
      : null;

  const mergedMetadata = { ...metadataBase };
  if (metadataPatch) {
    for (const [key, value] of Object.entries(metadataPatch)) {
      if (key === 'payment' && value && typeof value === 'object') {
        Object.assign(paymentMeta, value);
      } else {
        mergedMetadata[key] = value;
      }
    }
  }
  const finalStatus =
    updates.status ||
    (metadataPatch &&
      metadataPatch.payment &&
      typeof metadataPatch.payment.status === 'string' &&
      metadataPatch.payment.status) ||
    paymentMeta.status ||
    existing.payment_status;
  if (finalStatus) {
    paymentMeta.status = finalStatus;
  }
  mergedMetadata.payment = paymentMeta;

  const updateRes = await pool.query(
    'UPDATE orders SET payment_status = $1, metadata = $2, updated_at = now() WHERE id = $3 AND user_id = $4 RETURNING *',
    [paymentMeta.status, mergedMetadata, orderId, userId],
  );

  const updatedOrder = updateRes.rows[0];
  if (!updatedOrder) return null;

  const itemsRes = await pool.query(
    'SELECT * FROM order_items WHERE order_id = $1',
    [orderId],
  );
  updatedOrder.items = itemsRes.rows;
  const deliveryRes = await pool.query(
    `SELECT * FROM deliveries WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
  updatedOrder.delivery = parseDeliveryRow(deliveryRes.rows[0]);
  return updatedOrder;
}

module.exports = {
  pool,
  createOrderWithItems,
  getOrderWithItems,
  getOrderForUser,
  listOrdersByUser,
  updatePaymentForUser,
};
