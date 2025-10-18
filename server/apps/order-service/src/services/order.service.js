const model = require('../models/order.model');

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw validationError('items must contain at least one entry');
  }

  return items.map((item, index) => {
    const productId =
      item.product_id ||
      item.productId ||
      item.dishId ||
      item.id;
    if (!productId) {
      throw validationError(`items[${index}].product_id is required`);
    }

    const quantity = toNumber(item.quantity, NaN);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw validationError(`items[${index}].quantity must be greater than 0`);
    }

    const unitPrice = toNumber(
      item.unit_price ?? item.unitPrice ?? item.price,
      NaN
    );
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw validationError(`items[${index}].unit_price is required`);
    }

    const totalPrice = toNumber(
      item.total_price ?? item.totalPrice ?? unitPrice * quantity,
      NaN
    );
    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      throw validationError(
        `items[${index}].total_price must be provided or derivable`
      );
    }

    const snapshotCandidate =
      item.product_snapshot ||
      item.snapshot ||
      (typeof item === 'object' ? {
        title: item.title || item.name || null,
        size: item.size || null,
        image: item.image || null,
        restaurant_id: item.restaurant_id || item.restaurantId || null,
        additions: item.additions || item.extras || null,
      } : {});

    const productSnapshot =
      snapshotCandidate && typeof snapshotCandidate === 'object'
        ? snapshotCandidate
        : {};

    return {
      product_id: productId,
      variant_id: item.variant_id || item.variantId || null,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      product_snapshot: productSnapshot,
    };
  });
}

function formatOrder(order) {
  if (!order) return null;
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    id: order.id,
    user_id: order.user_id,
    restaurant_id: order.restaurant_id,
    branch_id: order.branch_id,
    status: order.status,
    payment_status: order.payment_status,
    total_amount: toNumber(order.total_amount),
    currency: order.currency,
    metadata: order.metadata || {},
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: items.map((item) => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: toNumber(item.unit_price),
      total_price: toNumber(item.total_price),
      product_snapshot: item.product_snapshot || {},
    })),
  };
}

async function create(payload = {}) {
  const userId = payload.user_id;
  if (!userId) throw validationError('user_id is required');
  if (!payload.restaurant_id) throw validationError('restaurant_id is required');

  const normalizedItems = normalizeItems(payload.items);

  const subtotal = normalizedItems.reduce(
    (sum, item) => sum + item.total_price,
    0
  );
  const shippingFee = toNumber(
    payload.shipping_fee ?? payload.delivery_fee ?? payload?.metadata?.pricing?.shipping_fee
  );
  const discount = toNumber(
    payload.discount ?? payload?.metadata?.pricing?.discount
  );

  const explicitTotal =
    payload.total_amount ?? payload?.metadata?.pricing?.total;
  const calculatedTotal = subtotal + shippingFee - discount;
  const totalAmountCandidate = toNumber(explicitTotal, calculatedTotal);
  const totalAmount = Math.max(
    0,
    Math.round(totalAmountCandidate * 100) / 100
  );

  const paymentMethod =
    (payload.payment_method || payload?.payment?.method || 'cod').toLowerCase();
  const paymentStatus =
    payload.payment_status ||
    payload?.payment?.status ||
    (paymentMethod === 'cod' ? 'pending' : 'paid');

  const metadataBase =
    payload.metadata && typeof payload.metadata === 'object'
      ? { ...payload.metadata }
      : {};

  const metadata = {
    ...metadataBase,
    pricing: {
      subtotal,
      shipping_fee: shippingFee,
      discount,
      total: totalAmount,
    },
    payment: {
      method: paymentMethod,
      status: paymentStatus,
      reference:
        payload?.payment?.reference || payload.payment_reference || null,
    },
    delivery_address:
      payload.delivery_address ||
      metadataBase.delivery_address ||
      null,
    notes: payload.notes || metadataBase.notes || null,
    cart_source: payload.cart_source || metadataBase.cart_source || null,
  };

  const orderRecord = await model.createOrderWithItems(
    {
      user_id: userId,
      restaurant_id: payload.restaurant_id,
      branch_id: payload.branch_id || null,
      status: payload.status || 'confirmed',
      payment_status: paymentStatus,
      total_amount: totalAmount,
      currency: payload.currency || 'VND',
      metadata,
    },
    normalizedItems
  );

  return formatOrder(orderRecord);
}

async function listByUser(userId) {
  if (!userId) throw validationError('user id missing');
  const orders = await model.listOrdersByUser(userId);
  return orders.map(formatOrder);
}

async function get(id, userId) {
  if (!userId) throw validationError('user id missing');
  const order = await model.getOrderForUser(id, userId);
  return formatOrder(order);
}

module.exports = { create, get, listByUser };
