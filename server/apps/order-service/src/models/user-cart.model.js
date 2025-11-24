const { pool } = require('../db');

const parseJsonField = (value, fallback = {}) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch {
      return fallback;
    }
  }
  return fallback;
};

const sanitizeCartItems = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [productId, variants] of Object.entries(value)) {
    if (!variants || typeof variants !== 'object') continue;
    const variantMap = {};
    for (const [cartKey, quantity] of Object.entries(variants)) {
      const parsedQty = Number(quantity);
      if (!Number.isFinite(parsedQty) || parsedQty <= 0) continue;
      const safeKey = String(cartKey).trim();
      if (!safeKey.length) continue;
      variantMap[safeKey] = parsedQty;
    }
    if (Object.keys(variantMap).length) {
      normalized[String(productId)] = variantMap;
    }
  }
  return normalized;
};

const sanitizeCartItemDetails = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [key, detail] of Object.entries(value)) {
    const safeKey = String(key).trim();
    if (!safeKey.length) continue;
    if (detail && typeof detail === 'object') {
      normalized[safeKey] = { ...detail };
    }
  }
  return normalized;
};

const mapRowToCart = (row, fallbackUserId = null) => ({
  user_id: row?.user_id || fallbackUserId,
  cart_items: parseJsonField(row?.cart_items, {}),
  cart_item_details: parseJsonField(row?.cart_item_details, {}),
  updated_at: row?.updated_at || null,
});

async function getCartByUserId(userId) {
  const { rows } = await pool.query(
    `SELECT user_id, cart_items, cart_item_details, updated_at
     FROM user_carts
     WHERE user_id = $1`,
    [userId],
  );
  if (!rows.length) {
    return {
      user_id: userId,
      cart_items: {},
      cart_item_details: {},
      updated_at: null,
    };
  }
  return mapRowToCart(rows[0], userId);
}

async function upsertCart(userId, cartItems, cartItemDetails) {
  const safeItems = sanitizeCartItems(cartItems);
  const safeDetails = sanitizeCartItemDetails(cartItemDetails);
  const { rows } = await pool.query(
    `INSERT INTO user_carts (user_id, cart_items, cart_item_details, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id)
     DO UPDATE SET cart_items = EXCLUDED.cart_items,
                   cart_item_details = EXCLUDED.cart_item_details,
                   updated_at = now()
     RETURNING user_id, cart_items, cart_item_details, updated_at`,
    [userId, safeItems, safeDetails],
  );
  return mapRowToCart(rows[0], userId);
}

async function deleteCart(userId) {
  await pool.query('DELETE FROM user_carts WHERE user_id = $1', [userId]);
  return {
    user_id: userId,
    cart_items: {},
    cart_item_details: {},
    updated_at: null,
  };
}

module.exports = {
  getCartByUserId,
  upsertCart,
  deleteCart,
};
