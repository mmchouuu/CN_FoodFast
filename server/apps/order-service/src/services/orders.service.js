const { pool } = require('../db');
const { publishOrderEvent } = require('../utils/rabbitmq');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeMetadata = (payload, totals) => {
  const base =
    payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? { ...payload.metadata }
      : {};

  const placedAt = new Date().toISOString();

  const paymentMeta =
    base.payment && typeof base.payment === 'object' && !Array.isArray(base.payment)
      ? { ...base.payment }
      : {};

  paymentMeta.method = payload.payment_method || paymentMeta.method || 'cod';
  paymentMeta.status = paymentMeta.status || 'pending';

  const pricingMeta =
    base.pricing && typeof base.pricing === 'object' && !Array.isArray(base.pricing)
      ? { ...base.pricing }
      : {};

  pricingMeta.subtotal = totals.subtotal;
  pricingMeta.shipping_fee = totals.shippingFee;
  pricingMeta.discount = totals.discount;
  pricingMeta.total = totals.totalAmount;

  const timeline = Array.isArray(base.timeline) ? base.timeline.slice() : null;

  const metadata = {
    ...base,
    pricing: pricingMeta,
    payment: paymentMeta,
    delivery_address: payload.delivery_address || base.delivery_address || null,
    placed_at: base.placed_at || placedAt,
  };

  if (!timeline || !timeline.length) {
    metadata.timeline = [
      {
        code: 'order.received',
        label: 'Order received',
        at: placedAt,
      },
    ];
  } else {
    metadata.timeline = timeline;
  }

  return metadata;
};

const normalizeOrderRow = (row) => {
  if (!row) {
    return null;
  }

  const items = Array.isArray(row.items)
    ? row.items.map((item) => ({
        ...item,
        unit_price: toNumber(item.unit_price, 0),
        total_price: toNumber(item.total_price, 0),
      }))
    : [];

  return {
    id: row.id,
    user_id: row.user_id,
    restaurant_id: row.restaurant_id,
    branch_id: row.branch_id,
    status: row.status,
    payment_status: row.payment_status,
    total_amount: toNumber(row.total_amount, 0),
    currency: row.currency || 'VND',
    metadata: row.metadata || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    items,
  };
};

const aggregateOrderQuery = `
  SELECT
    o.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'product_id', oi.product_id,
          'variant_id', oi.variant_id,
          'product_snapshot', oi.product_snapshot,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price
        )
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'
    ) AS items
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
`;

const fetchOrderById = async ({ client = pool, orderId, userId }) => {
  const params = [orderId];
  let query = `${aggregateOrderQuery} WHERE o.id = $1`;

  if (userId) {
    query += ' AND o.user_id = $2';
    params.push(userId);
  }

  query += ' GROUP BY o.id LIMIT 1';

  const result = await client.query(query, params);
  return normalizeOrderRow(result.rows[0]);
};

exports.listOrders = async ({ userId, limit = 50, offset = 0 }) => {
  const result = await pool.query(
    `
      ${aggregateOrderQuery}
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset],
  );

  return result.rows.map(normalizeOrderRow);
};

exports.getOrderById = async ({ orderId, userId }) => fetchOrderById({ orderId, userId });

exports.createOrder = async ({ userId, payload }) => {
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!items.length) {
    throw new ValidationError('Order must include at least one item');
  }

  const sanitizedItems = items.map((item, index) => {
    const productId = item.product_id || item.productId;
    const quantity = toNumber(item.quantity, 0);
    const unitPrice = toNumber(item.unit_price ?? item.unitPrice, 0);
    const totalPrice = toNumber(item.total_price ?? item.totalPrice, unitPrice * quantity);

    if (!productId) {
      throw new ValidationError(`Item at position ${index + 1} is missing product_id`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError(`Item at position ${index + 1} has invalid quantity`);
    }

    return {
      product_id: productId,
      variant_id: item.variant_id || item.variantId || null,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      product_snapshot:
        item.product_snapshot && typeof item.product_snapshot === 'object' && !Array.isArray(item.product_snapshot)
          ? item.product_snapshot
          : {},
    };
  });

  const subtotal = sanitizedItems.reduce((sum, item) => sum + item.total_price, 0);
  const shippingFee = toNumber(payload.shipping_fee, 0);
  const discount = toNumber(payload.discount, 0);
  const totalAmount = toNumber(payload.total_amount, subtotal + shippingFee - discount);

  if (totalAmount < 0) {
    throw new ValidationError('Order total cannot be negative');
  }

  const totals = { subtotal, shippingFee, discount, totalAmount };
  const metadata = sanitizeMetadata(payload, totals);

  const currency = (payload.currency || 'VND').trim() || 'VND';
  const branchId = payload.branch_id || payload.branchId || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `
        INSERT INTO orders (
          user_id,
          restaurant_id,
          branch_id,
          status,
          payment_status,
          total_amount,
          currency,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        userId,
        payload.restaurant_id,
        branchId,
        'pending',
        'unpaid',
        totalAmount,
        currency,
        metadata,
      ],
    );

    const order = orderResult.rows[0];

    const insertItemText = `
      INSERT INTO order_items (
        order_id,
        product_id,
        variant_id,
        product_snapshot,
        quantity,
        unit_price,
        total_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    for (const item of sanitizedItems) {
      await client.query(insertItemText, [
        order.id,
        item.product_id,
        item.variant_id,
        item.product_snapshot,
        item.quantity,
        item.unit_price,
        item.total_price,
      ]);
    }

    await client.query('COMMIT');

    const fullOrder = await fetchOrderById({ client, orderId: order.id, userId });

    try {
      await publishOrderEvent('order.created', {
        order_id: fullOrder.id,
        user_id: fullOrder.user_id,
        restaurant_id: fullOrder.restaurant_id,
        total_amount: fullOrder.total_amount,
        currency: fullOrder.currency,
      });
    } catch (eventError) {
      console.error('[order-service] Failed to publish order.created event:', eventError);
    }

    return fullOrder;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof ValidationError) {
      throw error;
    }
    console.error('[order-service] Transaction failed:', error);
    throw error;
  } finally {
    client.release();
  }
};
