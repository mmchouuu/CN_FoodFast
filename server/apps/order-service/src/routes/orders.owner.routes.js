const express = require('express');
const ownerController = require('../controllers/orders.owner.controller');

const router = express.Router();

router.get('/', ownerController.listOrders);
router.get('/:id', ownerController.getOrder);
router.patch('/:id/status', ownerController.updateStatus);
router.patch('/:id/cancel-request', ownerController.respondCancelRequest);
router.post('/:id/revisions', ownerController.createRevision);

module.exports = router;
