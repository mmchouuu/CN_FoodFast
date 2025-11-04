const express = require('express');
const adminController = require('../controllers/orders.admin.controller');

const router = express.Router();

router.get('/', adminController.listOrders);
router.get('/:id', adminController.getOrder);
router.patch('/:id', adminController.patchOrder);
router.delete('/:id', adminController.deleteOrder);

module.exports = router;
