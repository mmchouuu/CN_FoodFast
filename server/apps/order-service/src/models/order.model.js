const { Pool } = require('pg');
const config = require('../config');
const { deriveDeliveryRecord } = require('../utils/delivery');
const pool = new Pool(config.DB);

const parseJson = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
};

const normalizeDeliveryAddress = (address) => {
  if (!address) return null;
  if (typeof address === 'string') {
    return { formatted: address };
  }
  if (typeof address === 'object') {
    return { ...address };
  }
  return null;
};

async function createOrderWithItems(orderPayload, items, options = {}) {
  const { deliveryAddress = null } = options || {};
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const metadataPayload =
      orderPayload.metadata && typeof orderPayload.metadata === 'object'
        ? { ...orderPayload.metadata }
        : parseJson(orderPayload.metadata) || {};
    let normalizedDeliveryAddress = null;
    let deliveryStatus = null;
    if (deliveryAddress) {
      normalizedDeliveryAddress = normalizeDeliveryAddress(deliveryAddress);
      deliveryStatus =
        (deliveryAddress && (deliveryAddress.delivery_status || deliveryAddress.status)) ||
        'preparing';
      if (normalizedDeliveryAddress) {
        const existingDeliveryMeta =
          metadataPayload.delivery && typeof metadataPayload.delivery === 'object'
            ? { ...metadataPayload.delivery }
            : {};
        metadataPayload.delivery = {
          ...existingDeliveryMeta,
          delivery_status: deliveryStatus,
          delivery_address: existingDeliveryMeta.delivery_address || normalizedDeliveryAddress,
        };
        if (!metadataPayload.delivery_address) {
          metadataPayload.delivery_address = normalizedDeliveryAddress;
        }
      }
    }

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
        metadataPayload,
      ],
    );
    const order = orderRes.rows[0];

    const insertedItems = [];
    for (const item of items) {
      const itemRes = await client.query(
        `INSERT INTO order_items (
          order_id,
          product_id,
          variant_id,
          product_snapshot,
          quantity,
          unit_price,
          total_price,
          branch_product_id,
          branch_category_id
        )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          order.id,
          item.product_id,
          item.variant_id,
          item.product_snapshot || {},
          item.quantity,
          item.unit_price,
          item.total_price,
          item.branch_product_id || null,
          item.branch_category_id || null,
        ],
      );
      insertedItems.push(itemRes.rows[0]);
    }

    await client.query('COMMIT');
    order.items = insertedItems;
    const shippingSnapshot =
      parseJson(order.shipping_address_snapshot) || order.shipping_address_snapshot || null;
    order.metadata = metadataPayload;
    order.delivery =
      deriveDeliveryRecord(order, metadataPayload, shippingSnapshot) ||
      (normalizedDeliveryAddress
        ? {
            delivery_status: deliveryStatus || 'preparing',
            delivery_address: normalizedDeliveryAddress,
          }
        : null);
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
  const metadata = parseJson(order.metadata) || order.metadata || {};
  const shippingSnapshot =
    parseJson(order.shipping_address_snapshot) || order.shipping_address_snapshot || null;
  order.metadata = metadata;
  order.delivery = deriveDeliveryRecord(order, metadata, shippingSnapshot);
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
  const metadata = parseJson(order.metadata) || order.metadata || {};
  const shippingSnapshot =
    parseJson(order.shipping_address_snapshot) || order.shipping_address_snapshot || null;
  order.metadata = metadata;
  order.delivery = deriveDeliveryRecord(order, metadata, shippingSnapshot);
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

  return orders.map((order) => {
    const metadata = parseJson(order.metadata) || order.metadata || {};
    const shippingSnapshot =
      parseJson(order.shipping_address_snapshot) || order.shipping_address_snapshot || null;
    return {
      ...order,
      items: itemsByOrder.get(order.id) || [],
      metadata,
      delivery: deriveDeliveryRecord(order, metadata, shippingSnapshot),
    };
  });
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
  updatedOrder.metadata = parseJson(updatedOrder.metadata) || updatedOrder.metadata || {};
  updatedOrder.delivery = deriveDeliveryRecord(
    updatedOrder,
    updatedOrder.metadata,
    parseJson(updatedOrder.shipping_address_snapshot) || updatedOrder.shipping_address_snapshot || null,
  );
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
