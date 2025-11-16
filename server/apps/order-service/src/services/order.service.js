const { pool } = require('../db');
const advancedOrdersService = require('./orders.service');

class OrderValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderValidationError';
    this.statusCode = 400;
  }
}

const ensureNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseJson = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return { formatted: value };
    }
  }
  return null;
};

const sanitizeStatus = (value, allowed, fallback) => {
  if (!value || typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  const match = allowed.find((item) => item === normalized);
  return match || fallback;
};

const normalizeCurrency = (value) => {
  if (!value || typeof value !== 'string') return 'VND';
  const trimmed = value.trim();
  if (/^[a-zA-Z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return 'VND';
};

let hasMetadataColumnCache;
let hasPaymentMethodColumnCache;

const ensureMetadataColumn = async (client) => {
  if (hasMetadataColumnCache !== undefined) {
    return hasMetadataColumnCache;
  }
  try {
    const { rows } = await client.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'orders'
         AND column_name = 'metadata'
       LIMIT 1`,
    );
    hasMetadataColumnCache = rows.length > 0;
  } catch (error) {
    console.warn('[order-service] Failed to check metadata column presence:', error.message);
    hasMetadataColumnCache = false;
  }
  return hasMetadataColumnCache;
};

const ensurePaymentMethodColumn = async (client) => {
  if (hasPaymentMethodColumnCache !== undefined) {
    return hasPaymentMethodColumnCache;
  }
  try {
    const { rows } = await client.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'orders'
         AND column_name = 'payment_method'
       LIMIT 1`,
    );
    hasPaymentMethodColumnCache = rows.length > 0;
  } catch (error) {
    console.warn(
      '[order-service] Failed to check payment_method column presence:',
      error.message,
    );
    hasPaymentMethodColumnCache = false;
  }
  return hasPaymentMethodColumnCache;
};

const normalizePaymentInfo = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return { note: trimmed.slice(0, 200) };
  }

  if (Array.isArray(value)) {
    const filtered = value.filter((item) => item !== undefined);
    return filtered.length ? filtered : null;
  }

  if (typeof value === 'object') {
    const normalized = {};
    for (const [key, raw] of Object.entries(value)) {
      if (raw === undefined) continue;

      if (raw === null) {
        normalized[key] = null;
        continue;
      }

      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed) {
          normalized[key] = trimmed.slice(0, 200);
        }
        continue;
      }

      if (typeof raw === 'number' || typeof raw === 'boolean') {
        normalized[key] = raw;
        continue;
      }

      if (typeof raw === 'object') {
        normalized[key] = raw;
      }
    }

    return Object.keys(normalized).length ? normalized : null;
  }

  return null;
};

const sanitizePaymentMethod = (value) => {
  if (!value || typeof value !== 'string') return 'cod';
  const normalized = value.trim().toLowerCase();
  if (['cod', 'cash', 'card', 'wallet'].includes(normalized)) {
    return normalized;
  }
  return 'cod';
};

const pickFirst = (...candidates) => {
  for (const value of candidates) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
};

const buildOrderMetadata = ({
  payload,
  itemsSubtotal,
  itemsDiscount,
  orderDiscount,
  surchargesTotal,
  shippingFee,
  taxTotal,
  tipAmount,
  totalAmount,
  paymentMethod,
  paymentStatus,
  paymentInfo,
  shippingAddressSnapshot,
  shippingAddressId,
  restaurantId,
  items,
}) => {
  const pricing = {
    subtotal: itemsSubtotal,
    discount: itemsDiscount + orderDiscount,
    order_discount: orderDiscount,
    item_discount: itemsDiscount,
    surcharges_total: surchargesTotal,
    shipping_fee: shippingFee,
    tax_total: taxTotal,
    tip_amount: tipAmount,
    total: totalAmount,
  };

  const baseMetadata =
    payload.metadata && typeof payload.metadata === 'object' ? { ...payload.metadata } : {};

  const incomingPaymentInfo = normalizePaymentInfo(paymentInfo);
  const basePaymentInfo =
    baseMetadata.payment_info && typeof baseMetadata.payment_info === 'object'
      ? { ...baseMetadata.payment_info }
      : baseMetadata.payment_info ?? null;
  const mergedPaymentInfo =
    incomingPaymentInfo && basePaymentInfo && typeof basePaymentInfo === 'object'
      ? { ...basePaymentInfo, ...incomingPaymentInfo }
      : incomingPaymentInfo ?? basePaymentInfo ?? null;

  const restaurantIds =
    Array.isArray(baseMetadata.restaurant_ids) && baseMetadata.restaurant_ids.length
      ? baseMetadata.restaurant_ids
      : Array.isArray(payload.restaurant_ids) && payload.restaurant_ids.length
      ? payload.restaurant_ids
      : restaurantId
      ? [restaurantId]
      : [];

  const selectedAddressCandidateRaw =
    (payload.selectedAddress && typeof payload.selectedAddress === 'object'
      ? payload.selectedAddress
      : null) ||
    (payload.selected_address && typeof payload.selected_address === 'object'
      ? payload.selected_address
      : null);
  const selectedAddressCandidate = selectedAddressCandidateRaw
    ? { ...selectedAddressCandidateRaw }
    : null;
  const selectedAddressIdCandidate =
    payload.selectedAddressId ??
    payload.selected_address_id ??
    (selectedAddressCandidate && (selectedAddressCandidate.id || selectedAddressCandidate.address_id)) ??
    shippingAddressId ??
    null;

  const mergedMetadata = {
    ...baseMetadata,
    pricing: { ...pricing, ...(baseMetadata.pricing || {}) },
    payment: {
      ...(baseMetadata.payment || {}),
      method: paymentMethod,
      status: paymentStatus,
    },
    restaurant_ids: restaurantIds,
    delivery_address:
      baseMetadata.delivery_address || selectedAddressCandidate || shippingAddressSnapshot || null,
    delivery_address_id:
      baseMetadata.delivery_address_id ??
      baseMetadata.selected_address_id ??
      selectedAddressIdCandidate ??
      null,
    selected_address_id:
      baseMetadata.selected_address_id ?? selectedAddressIdCandidate ?? null,
    notes: baseMetadata.notes || payload.notes || payload.note || null,
  };

  if (baseMetadata.items_snapshot) {
    mergedMetadata.items_snapshot = baseMetadata.items_snapshot;
  } else if (Array.isArray(items) && items.length) {
    mergedMetadata.items_snapshot = items;
  }

  if (mergedPaymentInfo !== null && mergedPaymentInfo !== undefined) {
    mergedMetadata.payment_info = mergedPaymentInfo;
  } else if (baseMetadata.payment_info !== undefined) {
    mergedMetadata.payment_info = baseMetadata.payment_info;
  }

  if (selectedAddressCandidate) {
    const existingSelectedAddress =
      baseMetadata.selected_address && typeof baseMetadata.selected_address === 'object'
        ? baseMetadata.selected_address
        : {};
    mergedMetadata.selected_address = {
      ...existingSelectedAddress,
      ...selectedAddressCandidate,
    };
  } else if (baseMetadata.selected_address) {
    mergedMetadata.selected_address = baseMetadata.selected_address;
  } else if (!mergedMetadata.selected_address && shippingAddressSnapshot) {
    mergedMetadata.selected_address = shippingAddressSnapshot;
  }

  if (!mergedMetadata.restaurant_snapshot && Array.isArray(items) && items.length) {
    const firstSnapshot = items.find(
      (item) =>
        item.product_snapshot &&
        (item.product_snapshot.restaurant_id || item.product_snapshot.restaurantId),
    );
    if (firstSnapshot) {
      mergedMetadata.restaurant_snapshot = {
        ...(mergedMetadata.restaurant_snapshot || {}),
        ...(firstSnapshot.product_snapshot || {}),
      };
    }
  }

  if (!mergedMetadata.restaurant_names && Array.isArray(items)) {
    const map = {};
    for (const item of items) {
      const snapshot = item.product_snapshot;
      if (!snapshot) continue;
      const restId = snapshot.restaurant_id || snapshot.restaurantId;
      if (!restId || map[restId]) continue;
      if (snapshot.name || snapshot.title || snapshot.restaurant_name) {
        map[restId] =
          snapshot.restaurant_name || snapshot.name || snapshot.title || snapshot.restaurantId;
      }
    }
    if (Object.keys(map).length) {
      mergedMetadata.restaurant_names = {
        ...mergedMetadata.restaurant_names,
        ...map,
      };
    }
  }

  if (!mergedMetadata.created_by && payload.user_id) {
    mergedMetadata.created_by = payload.user_id;
  }

  return mergedMetadata;
};

const normalizeOrderItem = (raw, index) => {
  if (!raw || typeof raw !== 'object') {
    throw new OrderValidationError(`Invalid order item at position ${index + 1}`);
  }

  const quantity = Math.max(1, parseInt(raw.quantity, 10) || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new OrderValidationError(`Quantity is required for order item #${index + 1}`);
  }

  const unitPrice =
    ensureNumber(
      raw.unit_price ??
        raw.unitPrice ??
        raw.price ??
        (raw.total_price != null && quantity
          ? Number(raw.total_price) / quantity
          : raw.totalPrice != null && quantity
          ? Number(raw.totalPrice) / quantity
          : null),
      0,
    );

  const lineSubtotal = ensureNumber(
    raw.line_subtotal ?? raw.subtotal ?? unitPrice * quantity,
    unitPrice * quantity,
  );

  const lineDiscount = ensureNumber(
    raw.line_discount ?? raw.discount ?? raw.lineDiscount ?? raw.total_discount ?? raw.totalDiscount,
    0,
  );

  const lineTax = ensureNumber(
    raw.line_tax ?? raw.tax_amount ?? raw.tax ?? raw.taxAmount ?? raw.lineTax,
    0,
  );

  const lineTotal = ensureNumber(
    raw.line_total ??
      raw.total_price ??
      raw.totalPrice ??
      (lineSubtotal - lineDiscount + lineTax),
    lineSubtotal - lineDiscount + lineTax,
  );

  const allowedKinds = new Set(['product', 'combo', 'combo_item']);
  const itemKindRaw = (raw.item_kind || raw.itemKind || 'product').toString().trim().toLowerCase();
  const itemKind = allowedKinds.has(itemKindRaw) ? itemKindRaw : 'product';

  const titleSource =
    raw.title ||
    raw.name ||
    raw.product_name ||
    raw.productName ||
    raw.product_title ||
    raw.productTitle ||
    raw?.product_snapshot?.title ||
    raw?.product_snapshot?.name ||
    raw?.snapshot?.title ||
    `Item ${index + 1}`;
  const title = String(titleSource).trim().slice(0, 200) || `Item ${index + 1}`;

  const snapshot =
    raw.product_snapshot && typeof raw.product_snapshot === 'object'
      ? raw.product_snapshot
      : raw.snapshot && typeof raw.snapshot === 'object'
      ? raw.snapshot
      : null;

  return {
    parent_item_id: raw.parent_item_id || raw.parentItemId || null,
    item_kind: itemKind,
    is_priced:
      raw.is_priced !== undefined
        ? Boolean(raw.is_priced)
        : raw.isPriced !== undefined
        ? Boolean(raw.isPriced)
        : true,
    product_id: raw.product_id || raw.productId || raw.id || null,
    branch_product_id: raw.branch_product_id || raw.branchProductId || null,
    branch_category_id:
      raw.branch_category_id ||
      raw.branchCategoryId ||
      snapshot?.branch_category_id ||
      snapshot?.branchCategoryId ||
      null,
    title,
    image: raw.image || raw.product_image || raw.productImage || snapshot?.image || null,
    category_id: raw.category_id || raw.categoryId || null,
    unit_price: unitPrice,
    quantity,
    addons_total: ensureNumber(raw.addons_total ?? raw.addonsTotal, 0),
    line_subtotal: lineSubtotal,
    line_discount: lineDiscount,
    line_tax: lineTax,
    line_total: lineTotal,
    product_snapshot: snapshot,
  };
};

const normalizeDelivery = (raw) => {
  if (!raw) return null;

  const source =
    typeof raw === 'object'
      ? raw
      : {
          delivery_address: raw,
        };

  const addressSource = pickFirst(
    source.delivery_address,
    source.address,
    source.deliveryAddress,
    source.address_snapshot,
    source.snapshot,
    typeof raw === 'string' ? raw : null,
  );

  if (!addressSource) {
    return null;
  }

  let addressSnapshot;
  if (typeof addressSource === 'string') {
    addressSnapshot = { formatted: addressSource };
  } else if (addressSource && typeof addressSource === 'object') {
    addressSnapshot = { ...addressSource };
  } else {
    return null;
  }

  let serializedAddress;
  try {
    serializedAddress =
      typeof addressSource === 'string' ? addressSource : JSON.stringify(addressSnapshot);
  } catch {
    serializedAddress = JSON.stringify({ formatted: String(addressSource) });
  }

  const statusCandidate = pickFirst(source.delivery_status, source.status, 'preparing');
  let status = 'preparing';
  if (typeof statusCandidate === 'string') {
    status = statusCandidate.trim().toLowerCase() || 'preparing';
  } else if (statusCandidate && typeof statusCandidate.toString === 'function') {
    status = statusCandidate.toString().trim().toLowerCase() || 'preparing';
  }
  const estimatedAt = source.estimated_at || source.estimatedAt || null;
  const deliveredAt = source.delivered_at || source.deliveredAt || null;
  const proof =
    source.proof && typeof source.proof === 'object'
      ? source.proof
      : source.delivery_proof && typeof source.delivery_proof === 'object'
      ? source.delivery_proof
      : null;

  return {
    serializedAddress,
    snapshot: addressSnapshot,
    status: status || 'preparing',
    estimatedAt,
    deliveredAt,
    proof,
  };
};

const resolveShippingAddress = (payload, normalizedDelivery) => {
  const snapshotSource =
    payload.shipping_address_snapshot ??
    payload.shipping_address ??
    payload.delivery_address ??
    payload.address_snapshot ??
    payload.selectedAddress ??
    payload.selected_address ??
    (normalizedDelivery ? normalizedDelivery.snapshot : null);

  let snapshot = null;
  if (snapshotSource) {
    if (typeof snapshotSource === 'string') {
      snapshot = { formatted: snapshotSource };
    } else if (typeof snapshotSource === 'object') {
      snapshot = { ...snapshotSource };
    }
  }

  const id =
    payload.shipping_address_id ??
    payload.shippingAddressId ??
    payload.delivery_address_id ??
    payload.deliveryAddressId ??
    payload.selectedAddressId ??
    payload.selected_address_id ??
    (payload.selectedAddress &&
      (payload.selectedAddress.id || payload.selectedAddress.address_id)) ??
    (payload.selected_address &&
      (payload.selected_address.id || payload.selected_address.address_id)) ??
    (snapshot && (snapshot.id || snapshot.address_id)) ??
    (normalizedDelivery && normalizedDelivery.snapshot
      ? normalizedDelivery.snapshot.id || normalizedDelivery.snapshot.address_id
      : null) ??
    null;

  return { snapshot, id };
};

const parseDeliveryRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    order_id: row.order_id,
    delivery_status: row.delivery_status,
    estimated_at: row.estimated_at,
    delivered_at: row.delivered_at,
    proof: parseJson(row.proof),
    delivery_address: parseJson(row.delivery_address) || row.delivery_address || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const parseItemRow = (row) => ({
  id: row.id,
  order_id: row.order_id,
  parent_item_id: row.parent_item_id,
  item_kind: row.item_kind,
  is_priced: row.is_priced,
  product_id: row.product_id,
  branch_product_id: row.branch_product_id,
  branch_category_id: row.branch_category_id,
  title: row.title,
  image: row.image,
  category_id: row.category_id,
  unit_price: row.unit_price,
  quantity: row.quantity,
  addons_total: row.addons_total,
  line_subtotal: row.line_subtotal,
  line_discount: row.line_discount,
  line_tax: row.line_tax,
  line_total: row.line_total,
  product_snapshot: parseJson(row.product_snapshot),
});

const attachOrderRelations = async (orderRows) => {
  if (!orderRows.length) {
    return [];
  }

  const ids = orderRows.map((order) => order.id);

  const [itemsRes, deliveriesRes] = await Promise.all([
    pool.query(
      `SELECT id, order_id, parent_item_id, item_kind, is_priced, product_id, branch_product_id,
              branch_category_id, title, image, category_id, unit_price, quantity, addons_total, line_subtotal,
              line_discount, line_tax, line_total, product_snapshot
       FROM order_items
       WHERE order_id = ANY($1::uuid[])`,
      [ids],
    ),
    pool.query(
      `SELECT DISTINCT ON (order_id) id, order_id, delivery_status, delivery_address,
              estimated_at, delivered_at, proof, created_at, updated_at
       FROM deliveries
       WHERE order_id = ANY($1::uuid[])
       ORDER BY order_id, created_at DESC`,
      [ids],
    ),
  ]);

  const itemsByOrder = new Map();
  for (const row of itemsRes.rows) {
    const current = itemsByOrder.get(row.order_id) || [];
    current.push(parseItemRow(row));
    itemsByOrder.set(row.order_id, current);
  }

  const deliveriesByOrder = new Map();
  for (const row of deliveriesRes.rows) {
    deliveriesByOrder.set(row.order_id, parseDeliveryRow(row));
  }

  return orderRows.map((order) => {
    const meta =
      order.metadata && typeof order.metadata === 'object'
        ? order.metadata
        : parseJson(order.metadata);
    const paymentFromMeta =
      meta && meta.payment && typeof meta.payment === 'object' ? meta.payment.method : null;
    const deliveryRecord = deliveriesByOrder.get(order.id) || null;
    const shippingSnapshot =
      parseJson(order.shipping_address_snapshot) || order.shipping_address_snapshot || null;
    const deliverySnapshot =
      (deliveryRecord && deliveryRecord.delivery_address) ||
      (meta && meta.delivery_address) ||
      shippingSnapshot ||
      null;

    return {
      ...order,
      metadata: meta || order.metadata || null,
      payment_method: paymentFromMeta || order.payment_method || null,
      items: itemsByOrder.get(order.id) || [],
      delivery: deliveryRecord,
      delivery_snapshot: deliverySnapshot,
    };
  });
};

const getAllOrders = async () => {
  const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  return attachOrderRelations(result.rows);
};

const getOrderById = async (id) => {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
  if (!result.rows.length) return null;
  const [order] = await attachOrderRelations(result.rows);
  return order || null;
};

const deriveRestaurantId = (payload, items) => {
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const directValue =
    payload.restaurant_id ||
    payload.restaurantId ||
    metadata.restaurant_id ||
    metadata.restaurantId ||
    null;
  if (directValue) return directValue;

  const listValue =
    (Array.isArray(metadata.restaurant_ids) && metadata.restaurant_ids.length && metadata.restaurant_ids[0]) ||
    (Array.isArray(payload.restaurant_ids) && payload.restaurant_ids.length && payload.restaurant_ids[0]) ||
    null;
  if (listValue) return listValue;

  for (const item of items) {
    if (item.product_snapshot) {
      const snapshot = item.product_snapshot;
      if (snapshot.restaurant_id || snapshot.restaurantId) {
        return snapshot.restaurant_id || snapshot.restaurantId;
      }
    }
  }

  return null;
};

const deriveBranchId = (payload, items) => {
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const directValue =
    payload.branch_id ||
    payload.branchId ||
    metadata.branch_id ||
    metadata.branchId ||
    (Array.isArray(metadata.branch_ids) && metadata.branch_ids.length && metadata.branch_ids[0]) ||
    (Array.isArray(payload.branch_ids) && payload.branch_ids.length && payload.branch_ids[0]) ||
    null;
  if (directValue) return directValue;

  for (const item of items) {
    if (item.branch_id || item.branchId) {
      return item.branch_id || item.branchId;
    }
    if (item.product_snapshot) {
      const snapshot = item.product_snapshot;
      if (snapshot.branch_id || snapshot.branchId) {
        return snapshot.branch_id || snapshot.branchId;
      }
    }
  }

  return null;
};

const createOrder = async (payload, userContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userId =
      payload.user_id ||
      payload.userId ||
      (userContext && (userContext.id || userContext.user_id || userContext.userId || userContext.sub)) ||
      null;

    if (!userId) {
      throw new OrderValidationError('user_id is required');
    }

    const totalAmountRaw = payload.total_amount ?? payload.totalAmount;
    const totalAmount = Number(totalAmountRaw);
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      throw new OrderValidationError('total_amount must be a non-negative number');
    }

    const rawItems = Array.isArray(payload.order_items)
      ? payload.order_items
      : Array.isArray(payload.items)
      ? payload.items
      : [];

    if (!rawItems.length) {
      throw new OrderValidationError('order_items must contain at least one item');
    }

    const items = rawItems.map((item, index) => normalizeOrderItem(item, index));
    const itemsSubtotal = items.reduce((sum, item) => sum + ensureNumber(item.line_subtotal), 0);
    const itemsDiscount = items.reduce((sum, item) => sum + ensureNumber(item.line_discount), 0);
    const taxTotal = items.reduce((sum, item) => sum + ensureNumber(item.line_tax), 0);

    const restaurantId = deriveRestaurantId(payload, items);
    if (!restaurantId) {
      throw new OrderValidationError('restaurant_id is required');
    }

    const branchId =
      payload.branch_id ||
      payload.branchId ||
      (payload.metadata && (payload.metadata.branch_id || payload.metadata.branchId)) ||
      null;


    const deliveryInput =
      payload.delivery ||
      (payload.delivery_address
        ? {
            delivery_address: payload.delivery_address,
            delivery_status: payload.delivery_status || payload.deliveryStatus || payload.delivery_state,
            estimated_at:
              payload.delivery_estimated_at ||
              payload.estimated_delivery_at ||
              payload.estimated_at ||
              null,
            delivered_at: payload.delivered_at || payload.deliveredAt || null,
            proof: payload.delivery_proof || null,
          }
        : null);

    const normalizedDelivery = normalizeDelivery(deliveryInput);
    const { snapshot: shippingAddressSnapshot, id: shippingAddressId } = resolveShippingAddress(
      payload,
      normalizedDelivery,
    );

    const orderDiscount = ensureNumber(
      payload.order_discount ?? payload.discount ?? payload.orderDiscount,
      0,
    );
    const surchargesTotal = ensureNumber(
      payload.surcharges_total ?? payload.surcharge ?? payload.surchargesTotal,
      0,
    );
    const shippingFee = ensureNumber(
      payload.shipping_fee ?? payload.delivery_fee ?? payload.shippingFee,
      0,
    );
    const tipAmount = ensureNumber(payload.tip_amount ?? payload.tip ?? payload.tipAmount, 0);
    const promoCode =
      payload.promo_code ||
      payload.promoCode ||
      (payload.metadata && payload.metadata.discount_code ? payload.metadata.discount_code : null);
    const note = payload.note || payload.notes || null;

    const allowedOrderStatuses = [
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'delivering',
      'completed',
      'cancelled',
    ];
    const allowedPaymentStatuses = [
      'unpaid',
      'authorized',
      'paid',
      'refunded',
      'partially_refunded',
      'failed',
    ];

    const status = sanitizeStatus(payload.status, allowedOrderStatuses, 'pending');
    const paymentStatus = sanitizeStatus(
      payload.payment_status,
      allowedPaymentStatuses,
      'unpaid',
    );
    const paymentMethod = sanitizePaymentMethod(
      payload.payment_method || payload.paymentMethod || (payload.payment && payload.payment.method),
    );
    const paymentInfo =
      payload.payment_info ||
      payload.paymentInfo ||
      (payload.payment && (payload.payment.info || payload.payment.details || payload.payment.metadata)) ||
      null;

    const currency = normalizeCurrency(payload.currency);

    const orderMetadata = buildOrderMetadata({
      payload,
      itemsSubtotal,
      itemsDiscount,
      orderDiscount,
      surchargesTotal,
      shippingFee,
      taxTotal,
      tipAmount,
      totalAmount,
      paymentMethod,
      paymentStatus,
      paymentInfo,
      shippingAddressSnapshot,
      shippingAddressId,
      restaurantId,
      items,
    });

    const hasMetadataColumn = await ensureMetadataColumn(client);
    const hasPaymentMethodColumn = await ensurePaymentMethodColumn(client);

    const columns = ['user_id', 'restaurant_id', 'branch_id', 'status', 'payment_status'];
    const params = [userId, restaurantId, branchId, status, paymentStatus];

    if (hasPaymentMethodColumn) {
      columns.push('payment_method');
      params.push(paymentMethod);
    }

    columns.push(
      'items_subtotal',
      'items_discount',
      'order_discount',
      'surcharges_total',
      'shipping_fee',
      'tax_total',
      'tip_amount',
      'total_amount',
      'currency',
      'promo_code',
      'note',
      'shipping_address_id',
      'shipping_address_snapshot',
    );
    params.push(
      itemsSubtotal,
      itemsDiscount,
      orderDiscount,
      surchargesTotal,
      shippingFee,
      taxTotal,
      tipAmount,
      totalAmount,
      currency,
      promoCode || null,
      note || null,
      shippingAddressId || null,
      shippingAddressSnapshot || null,
    );

    if (hasMetadataColumn) {
      columns.push('metadata');
      params.push(orderMetadata);
    }

    const returningFields = [
      'id',
      'status',
      'total_amount',
      'created_at',
      'updated_at',
      'payment_status',
      'currency',
      'restaurant_id',
      'branch_id',
    ];
    if (hasPaymentMethodColumn) {
      returningFields.push('payment_method');
    }
    if (hasMetadataColumn) {
      returningFields.push('metadata');
    }

    const valuePlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(',');

    const orderRes = await client.query(
      `INSERT INTO orders (${columns.join(',')})
       VALUES (${valuePlaceholders})
       RETURNING ${returningFields.join(', ')}`,
      params,
    );

    const orderRow = orderRes.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (
          order_id,
          parent_item_id,
          item_kind,
          is_priced,
          product_id,
          branch_product_id,
          branch_category_id,
          title,
          image,
          category_id,
          unit_price,
          quantity,
          addons_total,
          line_subtotal,
          line_discount,
          line_tax,
          line_total,
          product_snapshot
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18

        )`,
        [
          orderRow.id,
          item.parent_item_id,
          item.item_kind,
          item.is_priced,
          item.product_id,
          item.branch_product_id,
          item.branch_category_id,
          item.title,
          item.image,
          item.category_id,
          item.unit_price,
          item.quantity,
          item.addons_total,
          item.line_subtotal,
          item.line_discount,
          item.line_tax,
          item.line_total,
          item.product_snapshot || null,
        ],
      );
    }

    if (normalizedDelivery) {
      await client.query(
        `INSERT INTO deliveries (
          order_id,
          delivery_address,
          delivery_status,
          estimated_at,
          delivered_at,
          proof
        )
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          orderRow.id,
          normalizedDelivery.serializedAddress,
          normalizedDelivery.status,
          normalizedDelivery.estimatedAt,
          normalizedDelivery.deliveredAt,
          normalizedDelivery.proof || null,
        ],
      );
    }

    await client.query(
      `INSERT INTO order_events (order_id, event_type, payload)
       VALUES ($1, $2, $3)`,
      [
        orderRow.id,
        'ORDER_CREATED',
        JSON.stringify({
          order_id: orderRow.id,
          user_id: userId,
          restaurant_id: restaurantId,
          total_amount: totalAmount,
          status,
          payment_status: paymentStatus,
          payment_method: paymentMethod,
        }),
      ],
    );

    await client.query('COMMIT');

    let hydratedOrder = await getOrderById(orderRow.id);
    if (hydratedOrder) {
      if (!hydratedOrder.metadata) {
        hydratedOrder.metadata = orderMetadata;
      } else if (orderMetadata && typeof orderMetadata === 'object') {
        hydratedOrder.metadata = {
          ...orderMetadata,
          ...hydratedOrder.metadata,
        };
      }
      hydratedOrder.payment_method = paymentMethod;
      return hydratedOrder;
    }

    return {
      ...orderRow,
      metadata: orderMetadata,
      payment_method: paymentMethod,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof OrderValidationError) {
      throw error;
    }
    console.error('[order-service] createOrder failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const updateOrderStatus = async (id, statusRaw) => {
  const allowedOrderStatuses = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'delivering',
    'completed',
    'cancelled',
  ];
  const status = sanitizeStatus(statusRaw, allowedOrderStatuses, null);
  if (!status) {
    throw new OrderValidationError('Invalid order status');
  }

  const result = await pool.query(
    `UPDATE orders
     SET status = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id],
  );

  if (!result.rows.length) return null;

  await pool.query(
    `INSERT INTO order_events (order_id, event_type, payload)
     VALUES ($1, $2, $3)`,
    [id, 'STATUS_UPDATED', JSON.stringify({ new_status: status })],
  );

  return attachOrderRelations(result.rows).then((rows) => rows[0] || null);
};

const deleteOrder = async (id) => {
  await pool.query('DELETE FROM orders WHERE id = $1', [id]);
  return { message: 'Order deleted successfully' };
};

const getOrdersByUserId = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return attachOrderRelations(result.rows);
};

const buildCustomerUserContext = (userId) => ({
  id: userId,
  userId,
  user_id: userId,
  sub: userId,
  role: 'customer',
});

const rethrowAdvancedServiceError = (error) => {
  if (error?.name === 'NotFoundError' || error?.status === 404) {
    const notFound = new OrderValidationError(error.message || 'Order not found');
    notFound.statusCode = 404;
    throw notFound;
  }
  if (error?.name === 'ForbiddenError' || error?.status === 403) {
    const forbidden = new OrderValidationError(error.message || 'Forbidden');
    forbidden.statusCode = 403;
    throw forbidden;
  }
  if (error?.name === 'ValidationError' || error?.status === 400) {
    const validationErr = new OrderValidationError(error.message || 'Request validation failed');
    validationErr.statusCode = 400;
    validationErr.details = error?.details;
    throw validationErr;
  }
  throw error;
};

const confirmCustomerOrder = async (orderId, userId, payload = {}) => {
  if (!orderId) {
    throw new OrderValidationError('order id is required');
  }
  if (!userId) {
    throw new OrderValidationError('user id is required');
  }

  const safePayload =
    payload && typeof payload === 'object'
      ? { ...payload }
      : {};

  try {
    return await advancedOrdersService.confirmCustomerOrderDelivery({
      user: buildCustomerUserContext(userId),
      orderId,
      payload: safePayload,
    });
  } catch (error) {
    rethrowAdvancedServiceError(error);
  }
};

const cancelCustomerOrder = async (orderId, userId, payload = {}) => {
  if (!orderId) {
    throw new OrderValidationError('order id is required');
  }
  if (!userId) {
    throw new OrderValidationError('user id is required');
  }

  const safePayload =
    payload && typeof payload === 'object'
      ? { ...payload }
      : {};

  try {
    return await advancedOrdersService.cancelCustomerOrder({
      user: buildCustomerUserContext(userId),
      orderId,
      payload: safePayload,
    });
  } catch (error) {
    rethrowAdvancedServiceError(error);
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getOrdersByUserId,
  cancelCustomerOrder,
  confirmCustomerOrder,
  OrderValidationError,
};
