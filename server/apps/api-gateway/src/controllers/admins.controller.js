const adminClient = require('../services/admin.client');

function withRequestHeaders(req) {
  return { headers: { 'x-request-id': req.id } };
}

async function listCustomers(req, res, next) {
  try {
    const result = await adminClient.listCustomers(withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function customerDetails(req, res, next) {
  try {
    const result = await adminClient.customerDetails(req.params.id, withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function updateCustomerStatus(req, res, next) {
  try {
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive boolean is required' });
    }
    const result = await adminClient.updateCustomerStatus(
      req.params.id,
      { isActive },
      withRequestHeaders(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listOwners(req, res, next) {
  try {
    const result = await adminClient.listOwners(withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function approveOwner(req, res, next) {
  try {
    const result = await adminClient.approveOwner(
      req.params.id,
      { adminUserId: req.user?.userId ?? null },
      withRequestHeaders(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function rejectOwner(req, res, next) {
  try {
    const result = await adminClient.rejectOwner(
      req.params.id,
      {
        adminUserId: req.user?.userId ?? null,
        reason: req.body?.reason || null,
      },
      withRequestHeaders(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createTaxTemplate(req, res, next) {
  try {
    const result = await adminClient.createTaxTemplate(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function assignTax(req, res, next) {
  try {
    const result = await adminClient.assignTax(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function createCalendar(req, res, next) {
  try {
    const result = await adminClient.createCalendar(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function createGlobalPromotion(req, res, next) {
  try {
    const result = await adminClient.createGlobalPromotion(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCustomers,
  customerDetails,
  updateCustomerStatus,
  listOwners,
  approveOwner,
  rejectOwner,
  createTaxTemplate,
  assignTax,
  createCalendar,
  createGlobalPromotion,
};
