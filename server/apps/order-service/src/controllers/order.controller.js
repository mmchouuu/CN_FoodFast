const jwt = require('jsonwebtoken');
const config = require('../config');
const OrderService = require('../services/order.service');

const JWT_SECRET = config.JWT_SECRET || 'secret';

const CANONICAL_DELIVERY_STATUSES = new Set([
  'preparing',
  'dispatched',
  'arriving',
  'delivered',
  'failed',
  'cancelled',
]);

const DELIVERY_STATUS_ALIASES = {
  pending: 'preparing',
  assigned: 'dispatched',
  dispatching: 'dispatched',
  delivering: 'arriving',
  enroute: 'arriving',
  completed: 'delivered',
  complete: 'delivered',
  done: 'delivered',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  preparing: 'preparing',
  dispatched: 'dispatched',
  arriving: 'arriving',
  delivered: 'delivered',
  failed: 'failed',
};

const DEFAULT_CANONICAL_DELIVERY_STATUS =
  normalizeDeliveryStatusValue('pending') || 'preparing';
const DELIVERY_STATUS_ERROR_MESSAGE =
  'delivery_status must be one of: pending, assigned, delivering, dispatched, arriving, delivered, failed, cancelled';

const decodeUserFromToken = (req) => {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const resolveUserIdFromRequest = (req, payload = {}) => {
  const direct =
    payload.user_id ||
    payload.userId ||
    req.query?.user_id ||
    req.query?.userId;
  if (direct) {
    const trimmed = String(direct).trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  const headerCandidate =
    req.headers?.['x-user-id'] ||
    req.headers?.['x-customer-id'] ||
    req.headers?.['x-owner-id'];
  if (headerCandidate) {
    const trimmed = String(headerCandidate).trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  const userFromToken = decodeUserFromToken(req);
  if (userFromToken) {
    const inferred =
      userFromToken.userId ||
      userFromToken.user_id ||
      userFromToken.id ||
      userFromToken.sub ||
      null;
    if (inferred) {
      const trimmed = String(inferred).trim();
      if (trimmed.length) {
        return trimmed;
      }
    }
  }

  return null;
};

function normalizeDeliveryStatusValue(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const asString =
    typeof value === 'string'
      ? value
      : typeof value.toString === 'function'
      ? value.toString()
      : null;
  if (!asString) {
    return null;
  }
  const key = asString.trim().toLowerCase();
  if (!key) {
    return null;
  }
  const canonical = DELIVERY_STATUS_ALIASES[key] || key;
  return CANONICAL_DELIVERY_STATUSES.has(canonical) ? canonical : null;
}

function resolveDeliveryStatusFromPayload(payload, selectedAddress, requireStatus) {
  const candidate =
    payload.delivery_status ??
    payload.deliveryStatus ??
    payload.delivery_state ??
    payload.delivery?.delivery_status ??
    payload.delivery?.status ??
    payload.delivery?.state ??
    selectedAddress?.delivery_status ??
    selectedAddress?.status ??
    payload.selectedAddress?.delivery_status ??
    payload.selected_address?.delivery_status ??
    payload.shipping_address?.delivery_status ??
    payload.shipping_address?.status ??
    payload.shippingAddress?.delivery_status ??
    payload.shippingAddress?.status ??
    null;

  const normalizedCandidate = normalizeDeliveryStatusValue(candidate);
  if (candidate !== undefined && candidate !== null && !normalizedCandidate) {
    return { isValid: false, value: null };
  }

  if (normalizedCandidate) {
    return { isValid: true, value: normalizedCandidate };
  }

  if (!requireStatus) {
    return { isValid: true, value: null };
  }

  return { isValid: true, value: DEFAULT_CANONICAL_DELIVERY_STATUS };
}

const respondWithError = (res, error) => {
  const status =
    (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : null) ||
    (Number.isInteger(error?.status) && error.status >= 400 && error.status < 600
      ? error.status
      : null) ||
    (Number.isInteger(error?.httpStatus) && error.httpStatus >= 400 && error.httpStatus < 600
      ? error.httpStatus
      : null) ||
    500;
  const message =
    status >= 500
      ? 'Internal server error'
      : error?.message || 'Request validation failed';

  if (status >= 500) {
    console.error('[order-service] controller error:', error);
  }

  return res.status(status).json({ error: message });
};

exports.getAllOrders = async (_req, res) => {
  try {
    const orders = await OrderService.getAllOrders();
    res.json(orders);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await OrderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.createOrder = async (req, res) => {
  try {
    const payload = req.body || {};
    const userIdFromToken =
      req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub || null;
    const totalAmount = payload.total_amount ?? payload.totalAmount;

    if (totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ error: 'total_amount is required' });
    }

    const normalizedUserId = userIdFromToken || payload.user_id || payload.userId;

    if (!normalizedUserId) {
      return res.status(400).json({ error: 'User context is missing' });
    }

    const normalizedPaymentMethod =
      typeof payload.payment_method === 'string'
        ? payload.payment_method
        : typeof payload.paymentMethod === 'string'
        ? payload.paymentMethod
        : typeof payload.payment?.method === 'string'
        ? payload.payment.method
        : null;

    const selectedAddress =
      payload.selectedAddress ||
      payload.selected_address ||
      payload.delivery_address ||
      payload.shipping_address ||
      null;

    const hasDeliveryContext =
      Boolean(
        payload.delivery ||
          payload.delivery_address ||
          payload.shipping_address ||
          payload.shippingAddress ||
          payload.selectedAddress ||
          payload.selected_address ||
          selectedAddress,
      );

    const {
      isValid: isDeliveryStatusValid,
      value: normalizedDeliveryStatus,
    } = resolveDeliveryStatusFromPayload(payload, selectedAddress, hasDeliveryContext);

    if (!isDeliveryStatusValid) {
      return res.status(400).json({ error: DELIVERY_STATUS_ERROR_MESSAGE });
    }

    const orderPayload = {
      ...payload,
      user_id: normalizedUserId,
    };

    if (selectedAddress) {
      orderPayload.selectedAddress =
        normalizedDeliveryStatus && typeof selectedAddress === 'object'
          ? { ...selectedAddress, delivery_status: normalizedDeliveryStatus }
          : selectedAddress;
    }

    if (normalizedDeliveryStatus) {
      orderPayload.delivery_status = normalizedDeliveryStatus;
      orderPayload.deliveryStatus = normalizedDeliveryStatus;
      if (orderPayload.delivery && typeof orderPayload.delivery === 'object') {
        orderPayload.delivery = {
          ...orderPayload.delivery,
          delivery_status: normalizedDeliveryStatus,
          status: normalizedDeliveryStatus,
        };
      }
    }

    if (normalizedPaymentMethod) {
      orderPayload.payment_method = normalizedPaymentMethod;
    }

    const order = await OrderService.createOrder(
      orderPayload,
      req.user || null,
    );
    res.status(201).json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await OrderService.updateOrderStatus(req.params.id, req.body.status);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const result = await OrderService.deleteOrder(req.params.id);
    res.json(result);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.getOrdersByUser = async (req, res) => {
  try {
    const orders = await OrderService.getOrdersByUserId(req.params.userId);
    res.json(orders);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.cancelOrder = async (req, res) => {
  const orderId = req.params.id || req.params.orderId;
  if (!orderId) {
    return res.status(400).json({ error: 'order id is required' });
  }

  const payload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  const userId = resolveUserIdFromRequest(req, payload);

  if (!userId) {
    return res.status(400).json({ error: 'user_id is required to cancel order' });
  }

  if (!payload.user_id) {
    payload.user_id = userId;
  }
  if (!payload.userId) {
    payload.userId = userId;
  }

  try {
    const order = await OrderService.cancelCustomerOrder(orderId, userId, payload);
    res.json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};

exports.confirmOrder = async (req, res) => {
  const orderId = req.params.id || req.params.orderId;
  if (!orderId) {
    return res.status(400).json({ error: 'order id is required' });
  }

  const payload = req.body && typeof req.body === 'object' ? { ...req.body } : {};
  const userId = resolveUserIdFromRequest(req, payload);

  if (!userId) {
    return res.status(400).json({ error: 'user_id is required to confirm order' });
  }

  if (!payload.user_id && !payload.userId) {
    payload.user_id = userId;
  }

  try {
    const order = await OrderService.confirmCustomerOrder(orderId, userId, payload);
    res.json(order);
  } catch (error) {
    respondWithError(res, error);
  }
};
