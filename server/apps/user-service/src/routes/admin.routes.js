const express = require('express');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

router.get('/customers', adminController.listCustomers);
router.get('/customers/:id', adminController.customerDetails);
router.patch('/customers/:id/status', adminController.updateCustomerStatus);

router.get('/owners', adminController.listOwnerApplicants);
router.post('/owners/:id/approve', adminController.approveOwner);
router.post('/owners/:id/reject', adminController.rejectOwner);

module.exports = router;
