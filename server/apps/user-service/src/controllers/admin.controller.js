const adminService = require('../services/admin.service');

async function listCustomers(req, res, next) {
  try {
    const { limit, offset } = req.query;
    const result = await adminService.listCustomers({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function updateCustomerStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive boolean is required' });
    }
    const result = await adminService.setCustomerActiveStatus(id, isActive);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function customerDetails(req, res, next) {
  try {
    const { id } = req.params;
    const result = await adminService.getCustomerDetails(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listOwnerApplicants(req, res, next) {
  try {
    const { status, limit, offset } = req.query;
    const result = await adminService.listOwnerApplicants({
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function approveOwner(req, res, next) {
  try {
    const { id } = req.params;
    const adminUserId = req.user?.userId;
    const result = await adminService.approveOwner(id, adminUserId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function rejectOwner(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const adminUserId = req.user?.userId;
    const result = await adminService.rejectOwner(id, adminUserId, reason);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCustomers,
  updateCustomerStatus,
  customerDetails,
  listOwnerApplicants,
  approveOwner,
  rejectOwner,
};
