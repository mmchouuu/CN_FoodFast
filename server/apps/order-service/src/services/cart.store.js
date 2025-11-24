const DEFAULT_VERSION = 1;
const MAX_CART_BYTES = 512 * 1024; // 512KB safety limit
const CART_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const cartStore = new Map();

const buildEmptyCartResponse = () => ({
  items: {},
  details: {},
  version: DEFAULT_VERSION,
  updated_at: null,
});

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sanitizeCartPayload = (payload = {}) => {
  const items =
    payload.items && typeof payload.items === 'object' && !Array.isArray(payload.items)
      ? payload.items
      : {};
  const details =
    payload.details && typeof payload.details === 'object' && !Array.isArray(payload.details)
      ? payload.details
      : {};
  const versionCandidate = Number(payload.version);
  const version = Number.isFinite(versionCandidate) ? versionCandidate : DEFAULT_VERSION;
  return { items, details, version };
};

const normalizeSnapshot = (userId, payload = {}) => {
  const { items, details, version } = sanitizeCartPayload(payload);
  const snapshot = {
    user_id: userId,
    items,
    details,
    version,
    updated_at: new Date().toISOString(),
  };

  const serialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CART_BYTES) {
    const err = new Error('cart payload too large');
    err.statusCode = 413;
    throw err;
  }

  return {
    snapshot,
    serialized,
  };
};

const getCart = (userId) => {
  const entry = cartStore.get(userId);
  if (!entry) {
    return buildEmptyCartResponse();
  }

  const expired = entry.savedAt && Date.now() - entry.savedAt > CART_TTL_MS;
  if (expired) {
    cartStore.delete(userId);
    return buildEmptyCartResponse();
  }

  return safeJsonParse(entry.serialized, entry.snapshot);
};

const saveCart = (userId, payload) => {
  const { snapshot, serialized } = normalizeSnapshot(userId, payload);
  cartStore.set(userId, { snapshot, serialized, savedAt: Date.now() });
  return snapshot;
};

const clearCart = (userId) => {
  const emptyPayload = { items: {}, details: {}, version: DEFAULT_VERSION };
  const { snapshot, serialized } = normalizeSnapshot(userId, emptyPayload);
  cartStore.set(userId, { snapshot, serialized, savedAt: Date.now() });
  return snapshot;
};

module.exports = {
  getCart,
  saveCart,
  clearCart,
};
