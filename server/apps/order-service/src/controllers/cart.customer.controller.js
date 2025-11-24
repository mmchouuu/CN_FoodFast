const cartStore = require('../services/cart.store');

const resolveUserId = (req) =>
  req.user?.userId ||
  req.user?.user_id ||
  req.user?.id ||
  req.headers?.['x-user-id'] ||
  req.headers?.['x-customer-id'] ||
  req.headers?.['x-cart-id'] ||
  req.headers?.['x-guest-id'] ||
  req.query?.customerId ||
  req.query?.customer_id ||
  req.query?.cartId ||
  req.query?.cart_id ||
  req.body?.customerId ||
  req.body?.customer_id ||
  req.body?.cartId ||
  req.body?.cart_id ||
  null;

exports.getCart = (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'user context is missing' });
  }
  const cart = cartStore.getCart(userId);
  return res.json(cart);
};

exports.replaceCart = (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'user context is missing' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    const saved = cartStore.saveCart(userId, payload);
    return res.json(saved);
  } catch (error) {
    const status =
      (Number.isInteger(error?.statusCode) && error.statusCode) ||
      (Number.isInteger(error?.status) && error.status) ||
      400;
    const message = error?.message || 'unable to save cart';
    return res.status(status).json({ error: message });
  }
};

exports.clearCart = (req, res) => {
  const userId = resolveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'user context is missing' });
  }
  cartStore.clearCart(userId);
  return res.status(204).end();
};
