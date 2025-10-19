const model = require('../models/order.model');
const userClient = require('../clients/user.client');

const VALID_PAYMENT_STATUSES = new Set([
  'pending',
  'paid',
  'failed',
  'refunded',
  'cancelled',
  'unpaid',
]);

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

function normalizeString(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeDeliveryAddress(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const normalized = {
    id:
      raw.id ||
      raw.address_id ||
      raw.addressId ||
      raw.delivery_address_id ||
      raw.deliveryAddressId ||
      null,
    label: normalizeString(raw.label) || 'Home',
    recipient: normalizeString(raw.recipient) || null,
    phone: normalizeString(raw.phone) || null,
    street: normalizeString(raw.street),
    ward: normalizeString(raw.ward),
    district: normalizeString(raw.district),
    city: normalizeString(raw.city),
    instructions: normalizeString(raw.instructions) || null,
  };
  return normalized;
}

function formatDeliveryAddressLine(address) {
  if (!address) return null;
  const parts = [
    address.street,
    address.ward,
    address.district,
    address.city,
  ].map(normalizeString).filter(Boolean);
  return parts.join(', ');
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
    delivery: order.delivery
      ? {
          id: order.delivery.id,
          status: order.delivery.delivery_status || order.delivery.status || null,
          address: order.delivery.delivery_address || null,
          estimated_at: order.delivery.estimated_at || null,
          delivered_at: order.delivery.delivered_at || null,
          proof: order.delivery.proof || null,
          created_at: order.delivery.created_at || null,
          updated_at: order.delivery.updated_at || null,
        }
      : null,
  };
}

async function create(payload = {}, context = {}) {
  const userId = payload.user_id;
  if (!userId) throw validationError('user_id is required');

  const authHeader =
    context?.authorization ||
    context?.Authorization ||
    null;

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (!rawItems.length) {
    throw validationError('items must contain at least one entry');
  }

  function getItemRestaurantId(it) {
    return (
      it?.restaurant_id ||
      it?.restaurantId ||
      it?.product_snapshot?.restaurant_id ||
      it?.snapshot?.restaurant_id ||
      null
    );
  }

  function getItemBranchId(it) {
    return (
      it?.branch_id ||
      it?.branchId ||
      it?.product_snapshot?.branch_id ||
      it?.snapshot?.branch_id ||
      null
    );
  }

  const groups = new Map();
  for (const item of rawItems) {
    const restaurantId = getItemRestaurantId(item) || payload.restaurant_id;
    if (!restaurantId) {
      throw validationError('Unable to determine restaurant_id for one or more items');
    }
    const list = groups.get(restaurantId) || [];
    list.push(item);
    groups.set(restaurantId, list);
  }

  const orderCount = groups.size;

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
  const deliveryAddressIdFromPayload =
    payload.delivery_address_id ||
    payload.address_id ||
    metadataBase.delivery_address_id ||
    (metadataBase.delivery_address &&
      (metadataBase.delivery_address.id ||
        metadataBase.delivery_address.address_id ||
        metadataBase.delivery_address.addressId)) ||
    null;

  let deliveryAddress = null;
  let deliveryAddressVerified = false;
  if (deliveryAddressIdFromPayload) {
    if (!authHeader) {
      throw validationError('authorization header missing');
    }
    const fetchedAddress = await userClient.getAddressById(
      deliveryAddressIdFromPayload,
      authHeader
    );
    if (!fetchedAddress) {
      throw validationError('delivery address not found');
    }
    deliveryAddress = normalizeDeliveryAddress(fetchedAddress);
    deliveryAddressVerified = true;
  }

  if (!deliveryAddress) {
    const fallbackSource =
      payload.delivery_address ||
      metadataBase.delivery_address ||
      null;
    if (fallbackSource) {
      deliveryAddress = normalizeDeliveryAddress(fallbackSource);
    }
  }

  if (!deliveryAddress || !deliveryAddress.street) {
    throw validationError('delivery address is required');
  }

  deliveryAddress.id =
    deliveryAddress.id || deliveryAddressIdFromPayload || null;
  const deliveryAddressLine =
    metadataBase.delivery_address_line ||
    formatDeliveryAddressLine(deliveryAddress);
  const deliveryRecordPayload = {
    ...deliveryAddress,
    full_address: deliveryAddressLine,
  };
  if (deliveryAddressVerified) {
    deliveryRecordPayload.verified_via = 'user-service';
  }

  metadataBase.delivery_address = deliveryAddress;
  metadataBase.delivery_address_id = deliveryAddress.id;
  metadataBase.delivery_address_line = deliveryAddressLine;
  if (deliveryAddressVerified) {
    metadataBase.delivery_address_verified = true;
  }

  const restaurantSnapshotsBase =
    metadataBase.restaurant_snapshots && typeof metadataBase.restaurant_snapshots === 'object'
      ? metadataBase.restaurant_snapshots
      : null;

  function allocateEvenly(totalAmount) {
    const amount = toNumber(totalAmount, 0);
    if (orderCount <= 1) {
      return [amount];
    }
    const totalCents = Math.round(amount * 100);
    const baseShare = Math.floor(totalCents / orderCount);
    let remainder = totalCents - baseShare * orderCount;
    const shares = [];
    for (let i = 0; i < orderCount; i += 1) {
      let shareCents = baseShare;
      if (remainder > 0) {
        shareCents += 1;
        remainder -= 1;
      }
      shares.push(shareCents / 100);
    }
    return shares;
  }

  const shippingShares = allocateEvenly(
    payload.shipping_fee ?? payload.delivery_fee ?? payload?.metadata?.pricing?.shipping_fee
  );
  const discountShares = allocateEvenly(
    payload.discount ?? payload?.metadata?.pricing?.discount
  );

  const createdOrders = [];
  let index = 0;
  for (const [restaurantId, itemsOfRestaurant] of groups.entries()) {
    const normalizedItems = normalizeItems(itemsOfRestaurant);
    const subtotal = normalizedItems.reduce(
      (sum, item) => sum + item.total_price,
      0
    );
    const shippingFee = shippingShares[index] ?? 0;
    const discount = discountShares[index] ?? 0;
    const explicitTotal =
      payload.total_amount ?? payload?.metadata?.pricing?.total;
    const calculatedTotal = subtotal + shippingFee - discount;
    const totalAmountCandidate =
      orderCount > 1
        ? calculatedTotal
        : toNumber(explicitTotal, calculatedTotal);
    const totalAmount = Math.max(
      0,
      Math.round(totalAmountCandidate * 100) / 100
    );

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
      delivery_address: metadataBase.delivery_address || deliveryAddress,
      delivery_address_id:
        metadataBase.delivery_address_id ||
        deliveryAddress.id ||
        null,
      delivery_address_line:
        metadataBase.delivery_address_line || deliveryAddressLine || null,
      delivery_address_verified: Boolean(metadataBase.delivery_address_verified),
      notes: payload.notes || metadataBase.notes || null,
      cart_source: payload.cart_source || metadataBase.cart_source || null,
      restaurant_id: restaurantId,
    };

    if (!metadata.restaurant_ids) {
      metadata.restaurant_ids = Array.from(groups.keys());
    }

    const snapshotFromMap =
      restaurantSnapshotsBase?.[restaurantId] ??
      restaurantSnapshotsBase?.[String(restaurantId)] ??
      null;

    if (snapshotFromMap && typeof snapshotFromMap === 'object') {
      metadata.restaurant_snapshot = snapshotFromMap;
      if (!metadata.restaurant_name && snapshotFromMap.name) {
        metadata.restaurant_name = snapshotFromMap.name;
      }
      if (!metadata.restaurant_image && snapshotFromMap.image) {
        metadata.restaurant_image = snapshotFromMap.image;
      }
    } else if (
      metadata.restaurant_snapshot &&
      typeof metadata.restaurant_snapshot === 'object' &&
      metadata.restaurant_snapshot.id &&
      metadata.restaurant_snapshot.id !== restaurantId
    ) {
      // Ensure mismatched snapshot is not re-used for another restaurant
      delete metadata.restaurant_snapshot;
    }

    const pricingBreakdownMap =
      metadata.pricing_breakdown && typeof metadata.pricing_breakdown === 'object'
        ? metadata.pricing_breakdown
        : null;
    if (pricingBreakdownMap) {
      const breakdown =
        pricingBreakdownMap[restaurantId] ??
        pricingBreakdownMap[String(restaurantId)] ??
        null;
      if (breakdown) {
        metadata.pricing_breakdown_current = breakdown;
      }
    }

    if (!metadata.branch_id) {
      metadata.branch_id = payload.branch_id || getItemBranchId(itemsOfRestaurant[0]) || null;
    }

    const orderDeliveryPayload = {
      ...deliveryRecordPayload,
      restaurant_id: restaurantId,
    };

    const orderRecord = await model.createOrderWithItems(
      {
        user_id: userId,
        restaurant_id: restaurantId,
        branch_id:
          payload.branch_id ||
          getItemBranchId(itemsOfRestaurant[0]) ||
          null,
        status: payload.status || 'confirmed',
        payment_status: paymentStatus,
        total_amount: totalAmount,
        currency: payload.currency || 'VND',
        metadata,
      },
      normalizedItems,
      { deliveryAddress: orderDeliveryPayload }
    );
    createdOrders.push(formatOrder(orderRecord));
    index += 1;
  }

  return createdOrders.length === 1 ? createdOrders[0] : createdOrders;
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

function normalizeIsoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function updatePayment(orderId, userId, payload = {}) {
  if (!orderId) throw validationError('order id missing');
  if (!userId) throw validationError('user id missing');

  const statusRaw =
    payload.status ||
    payload.payment_status ||
    payload.paymentStatus ||
    null;
  const status =
    typeof statusRaw === 'string' ? statusRaw.trim().toLowerCase() : null;
  if (status && !VALID_PAYMENT_STATUSES.has(status)) {
    throw validationError(
      `payment status must be one of: ${Array.from(VALID_PAYMENT_STATUSES).join(', ')}`
    );
  }

  let amount = null;
  if (Object.prototype.hasOwnProperty.call(payload, 'amount')) {
    amount = toNumber(payload.amount, NaN);
    if (!Number.isFinite(amount) || amount < 0) {
      throw validationError('amount must be a non-negative number');
    }
  }

  const currency =
    typeof payload.currency === 'string' && payload.currency.trim()
      ? payload.currency.trim().toUpperCase()
      : null;

  const metadataPatch =
    payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : null;

  const orderRecord = await model.updatePaymentForUser(orderId, userId, {
    status,
    method:
      payload.method ||
      payload.payment_method ||
      payload.paymentMethod ||
      null,
    reference:
      payload.reference ||
      payload.payment_reference ||
      payload.paymentReference ||
      null,
    transaction_id:
      payload.transaction_id ||
      payload.transactionId ||
      payload.txn_id ||
      null,
    paid_at: normalizeIsoDate(payload.paid_at || payload.paidAt),
    amount,
    currency,
    metadata: metadataPatch,
  });

  if (!orderRecord) return null;
  return formatOrder(orderRecord);
}

module.exports = { create, get, listByUser, updatePayment };
