const { randomUUID } = require('crypto');
const model = require('../models/payment.model');
const orderClient = require('../clients/order.client');

const VALID_PAYMENT_STATUSES = new Set([
  'pending',
  'paid',
  'failed',
  'refunded',
  'cancelled',
]);

function validationError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function toNumber(value, fallback = NaN) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(statusRaw) {
  if (!statusRaw || typeof statusRaw !== 'string') return null;
  const status = statusRaw.trim().toLowerCase();
  if (!VALID_PAYMENT_STATUSES.has(status)) {
    throw validationError(
      `status must be one of: ${Array.from(VALID_PAYMENT_STATUSES).join(', ')}`
    );
  }
  return status;
}

function normalizeCurrency(currency) {
  if (!currency || typeof currency !== 'string') return 'VND';
  return currency.trim().toUpperCase();
}

async function create(payload = {}, context = {}) {
  const userId = payload.user_id;
  if (!userId) throw validationError('user_id is required');

  const orderId = payload.order_id;
  if (!orderId) throw validationError('order_id is required');

  const amount = toNumber(payload.amount, NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw validationError('amount must be greater than 0');
  }

  const currency = normalizeCurrency(payload.currency);
  const paymentMethodRaw =
    payload.payment_method ||
    payload.method ||
    payload.paymentMethod ||
    'card';
  const paymentMethod =
    typeof paymentMethodRaw === 'string'
      ? paymentMethodRaw.trim().toLowerCase() || 'card'
      : 'card';

  const requestedStatus =
    payload.status || payload.payment_status || payload.paymentStatus || null;
  let status = null;
  if (requestedStatus) {
    status = normalizeStatus(requestedStatus);
  }

  const deferredMethods = new Set([
    'cod',
    'cash',
    'cash_on_delivery',
    'qr_on_delivery',
    'bank_transfer',
  ]);
  if (!status) {
    status = deferredMethods.has(paymentMethod) ? 'pending' : 'paid';
  }

  const idempotencyKey = payload.idempotency_key || null;
  const paymentMethodId = payload.payment_method_id || null;
  const authHeader = context.authorization;
  if (!authHeader) throw validationError('authorization header missing');

  if (idempotencyKey) {
    const existing = await model.findPaymentByIdempotencyKey(
      idempotencyKey,
      userId
    );
    if (existing) {
      return existing;
    }
  }

  let paidAtDate = null;
  if (payload.paid_at || payload.paidAt) {
    const candidate = new Date(payload.paid_at || payload.paidAt);
    if (Number.isNaN(candidate.getTime())) {
      throw validationError('paid_at must be a valid date');
    }
    paidAtDate = candidate;
  } else if (status === 'paid') {
    paidAtDate = new Date();
  }

  if (paidAtDate && Number.isNaN(paidAtDate.getTime())) {
    throw validationError('paid_at must be a valid date');
  }

  const transactionId =
    payload.transaction_id ||
    payload.transactionId ||
    `txn_${randomUUID().replace(/-/g, '')}`;

  const metadata =
    payload.metadata && typeof payload.metadata === 'object'
      ? payload.metadata
      : null;

  const client = await model.pool.connect();
  try {
    await client.query('BEGIN');

    const paymentRecord = await model.createPayment(
      {
        order_id: orderId,
        user_id: userId,
        payment_method_id: paymentMethodId,
        idempotency_key: idempotencyKey,
        amount,
        currency,
        status,
        transaction_id: transactionId,
        paid_at: paidAtDate,
      },
      client
    );

    const orderPatch = {
      status,
      method: paymentMethod,
      reference: idempotencyKey || paymentRecord.id,
      transaction_id: transactionId,
      paid_at: paidAtDate ? paidAtDate.toISOString() : null,
      amount,
      currency,
    };
  const metadataPatch = metadata ? { ...metadata } : {};
  if (
    !metadataPatch.payment ||
    typeof metadataPatch.payment !== 'object'
  ) {
      metadataPatch.payment = {};
    }
    metadataPatch.payment.payment_id =
      metadataPatch.payment.payment_id || paymentRecord.id;
    if (paidAtDate) {
      metadataPatch.payment.paid_at = paidAtDate.toISOString();
    }
  metadataPatch.payment.status = status;
  metadataPatch.payment.method = paymentMethod;
  metadataPatch.payment.transaction_id = transactionId;
  metadataPatch.payment.amount = amount;
  metadataPatch.payment.currency = currency;
  const paymentProvider =
    payload.provider ||
    payload.payment_provider ||
    payload.gateway ||
    null;
  if (paymentProvider) {
    metadataPatch.payment.provider = paymentProvider;
  }
  orderPatch.metadata = metadataPatch;

    await orderClient.updateOrderPayment(orderId, orderPatch, authHeader);

    await client.query('COMMIT');
    return paymentRecord;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function get(id, userId) {
  if (!userId) throw validationError('user_id is required');
  return model.getPaymentForUser(id, userId);
}

module.exports = { create, get };
