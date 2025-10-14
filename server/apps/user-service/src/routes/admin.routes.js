// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// ADMIN-protected in production (add auth middleware)
router.put('/approve-restaurant/:id', adminController.approveRestaurant); // admin approves restaurant by id
router.get('/users', adminController.listUsers);

module.exports = router;
