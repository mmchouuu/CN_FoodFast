// api-gateway/src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/admins.controller');

// IMPORTANT: protect these endpoints with auth + role guard in production
router.put('/approve-restaurant/:id', controller.approveRestaurant);
router.get('/users', controller.listUsers);
router.get('/customers', controller.listCustomers);
router.get('/restaurants', controller.listRestaurants);
router.get('/users/:id', controller.getUserDetails);
router.patch('/users/:id/active', controller.updateUserActiveStatus);

module.exports = router;
