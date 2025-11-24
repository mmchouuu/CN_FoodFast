const userCartModel = require('../models/user-cart.model');

class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    if (details) {
      this.details = details;
    }
  }
}

const resolveUserId = (user = {}) =>
  user.id || user.userId || user.sub || user.user_id || null;

const mapCartRecordToResponse = (record = {}) => ({
  userId: record.user_id || null,
  cartItems: record.cart_items || {},
  cartItemDetails: record.cart_item_details || {},
  updatedAt: record.updated_at || record.updatedAt || null,
});

const hasCartContent = (items = {}, details = {}) => {
  if (items && typeof items === 'object') {
    for (const productId of Object.keys(items)) {
      const bag = items[productId];
      if (bag && typeof bag === 'object' && Object.keys(bag).length) {
        return true;
      }
    }
  }
  if (details && typeof details === 'object') {
    return Object.keys(details).length > 0;
  }
  return false;
};

async function getCustomerCart({ user }) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new ValidationError('unable to resolve current user');
  }
  const cart = await userCartModel.getCartByUserId(userId);
  return mapCartRecordToResponse(cart);
}

async function saveCustomerCart({ user, payload = {} }) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new ValidationError('unable to resolve current user');
  }
  const cartItems = payload.cartItems || payload.cart_items || {};
  const cartItemDetails = payload.cartItemDetails || payload.cart_item_details || {};

  if (!hasCartContent(cartItems, cartItemDetails)) {
    const cart = await userCartModel.deleteCart(userId);
    return mapCartRecordToResponse(cart);
  }

  const cart = await userCartModel.upsertCart(userId, cartItems, cartItemDetails);
  return mapCartRecordToResponse(cart);
}

async function clearCustomerCart({ user }) {
  const userId = resolveUserId(user);
  if (!userId) {
    throw new ValidationError('unable to resolve current user');
  }
  const cart = await userCartModel.deleteCart(userId);
  return mapCartRecordToResponse(cart);
}

module.exports = {
  getCustomerCart,
  saveCustomerCart,
  clearCustomerCart,
  ValidationError,
};
