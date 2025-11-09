const paymentsService = require('../services/payments.service');

exports.lookupPayments = async (req, res) => {
  try {
    const orderIds = Array.isArray(req.body?.order_ids)
      ? req.body.order_ids.filter(Boolean)
      : [];

    if (!orderIds.length) {
      return res.json({ payments: [] });
    }

    const payments = await paymentsService.getPaymentsForOrders(orderIds);
    return res.json({ payments });
  } catch (error) {
    console.error('[payment-service] lookupPayments failed:', error);
    const status = error?.status || error?.httpStatus || 500;
    return res.status(status).json({
      error: error?.message || 'Internal server error',
    });
  }
};
