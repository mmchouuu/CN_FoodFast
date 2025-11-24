import api from './api';

const basePath = '/customer/cart';

const buildCartRequestConfig = (identity) => {
  const normalized =
    typeof identity === 'string' && identity.trim().length
      ? identity.trim()
      : identity != null
        ? String(identity).trim()
        : '';
  if (!normalized) {
    return {};
  }
  return {
    headers: {
      'x-cart-id': normalized,
      'x-customer-id': normalized,
    },
  };
};

export async function fetchCart(identity) {
  const config = buildCartRequestConfig(identity);
  const { data } = await api.get(basePath, config);
  if (data && typeof data === 'object') {
    return data;
  }
  return { items: {}, details: {} };
}

export async function saveCart(payload = {}, identity) {
  const body = {
    items: payload.items || {},
    details: payload.details || {},
    version: payload.version || 1,
  };
  const config = buildCartRequestConfig(identity);
  const { data } = await api.put(basePath, body, config);
  return data;
}

export async function clearCart(identity) {
  const config = buildCartRequestConfig(identity);
  await api.delete(basePath, config);
  return true;
}

const cartService = {
  fetchCart,
  saveCart,
  clearCart,
};

export default cartService;
