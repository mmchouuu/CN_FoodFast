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

exports.confirmCashPayment = async (req, res) => {
  try {
    const orderId = req.body?.order_id || req.body?.orderId;
    const userId = req.body?.user_id || req.body?.userId || null;

    if (!orderId) {
      return res.status(400).json({ error: 'order_id is required' });
    }

    const payment = await paymentsService.confirmCashPayment({
      orderId,
      userId,
    });

    return res.json({ payment });
  } catch (error) {
    console.error('[payment-service] confirmCashPayment failed:', error);
    const status = error?.status || error?.httpStatus || 500;
    return res.status(status).json({
      error: error?.message || 'Internal server error',
    });
  }
};
