// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// ADMIN-protected in production (add auth middleware)
router.put('/approve-restaurant/:id', adminController.approveRestaurant);
router.get('/users', adminController.listUsers);
router.get('/customers', adminController.listCustomers);
router.get('/restaurants', adminController.listRestaurants);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/active', adminController.updateActiveStatus);

module.exports = router;
