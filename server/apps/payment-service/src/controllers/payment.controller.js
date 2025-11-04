const paymentsService = require('../services/payments.service');

const resolveUserId = (req, body = {}) =>
  req.user?.id ||
  req.user?.userId ||
  req.user?.user_id ||
  req.headers['x-user-id'] ||
  req.headers['x-userid'] ||
  body.user_id ||
  body.userId ||
  null;

const toAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const mapError = (res, error) => {
  const status =
    error?.statusCode ||
    error?.status ||
    error?.httpStatus ||
    (error?.name === 'ValidationError' ? 400 : 500);

  return res.status(status).json({
    error: error?.message || 'Internal server error',
    details: error?.details || undefined,
  });
};

exports.listPayments = async (req, res) => {
  try {
    const userId = resolveUserId(req, req.query);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;

    const result = await paymentsService.listPayments({
      userId,
      limit,
      offset,
      status: req.query.status || null,
      flow: req.query.flow || null,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });

    return res.json(result);
  } catch (error) {
    console.error('[payment-service] listPayments failed:', error);
    return mapError(res, error);
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const payment = await paymentsService.getPaymentForUser(
      req.params.id,
      userId,
    );
    if (!payment) {
      return res.status(404).json({ error: 'payment not found' });
    }

    return res.json(payment);
  } catch (error) {
    console.error('[payment-service] getPaymentById failed:', error);
    return mapError(res, error);
  }
};

exports.createPayment = async (req, res) => {
  const body = req.body || {};
  try {
    const userId = resolveUserId(req, body);
    if (!userId) {
      return res.status(401).json({ error: 'user id is required' });
    }

    const orderId = body.order_id || body.orderId;
    if (!orderId) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    const amount = toAmount(body.amount);
    if (amount === null || amount < 0) {
      return res.status(400).json({ error: 'amount must be a valid number' });
    }

    const flowRaw =
      body.flow ||
      body.payment_flow ||
      body.paymentFlow ||
      body.payment_method ||
      body.paymentMethod ||
      null;
    const flow =
      typeof flowRaw === 'string' &&
      ['cash', 'cod', 'cash_on_delivery'].includes(flowRaw.toLowerCase())
        ? 'cash'
        : 'online';

    const payment = await paymentsService.handlePaymentPending({
      order_id: orderId,
      user_id: userId,
      restaurant_id: body.restaurant_id || body.restaurantId || null,
      branch_id: body.branch_id || body.branchId || null,
      amount,
      currency: body.currency || 'VND',
      flow,
      method: body.payment_method || body.paymentMethod || null,
      idempotency_key: body.idempotency_key || body.idempotencyKey || null,
      metadata: body.metadata || {},
    });

    if (!payment) {
      return res.status(409).json({
        error: 'Unable to process payment without a default method',
        status: 'failed',
      });
    }

    const statusCode =
      payment.status === 'succeeded'
        ? 201
        : payment.status === 'pending'
        ? 202
        : 200;

    return res.status(statusCode).json(payment);
  } catch (error) {
    console.error('[payment-service] createPayment failed:', error);
    return mapError(res, error);
  }
};
