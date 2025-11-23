const refundsService = require('../services/refunds.service');

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

exports.createRefund = async (req, res) => {
  const body = req.body || {};
  try {
    const refund = await refundsService.processRefund({
      paymentId: body.payment_id || body.paymentId,
      orderId: body.order_id || body.orderId,
      amount: body.amount,
      reason: body.reason,
      idempotencyKey: body.idempotency_key || body.idempotencyKey,
    });
    return res.status(201).json(refund);
  } catch (error) {
    console.error('[payment-service] createRefund failed:', error);
    return mapError(res, error);
  }
};
