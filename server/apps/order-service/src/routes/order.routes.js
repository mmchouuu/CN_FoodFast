// const express = require('express');
// const router = express.Router();
// const ctrl = require('../controllers/order.controller');

// router.post('/', ctrl.create);
// router.get('/:id', ctrl.get);

// module.exports = router;


import express from "express";
import * as OrderController from "../controllers/order.controller.js";

const router = express.Router();

router.get("/", OrderController.getAllOrders);
router.get("/user/:userId", OrderController.getOrdersByUser);
router.get("/:id", OrderController.getOrderById);
router.post("/", OrderController.createOrder);
router.put("/:id/status", OrderController.updateOrderStatus);
router.delete("/:id", OrderController.deleteOrder);

export default router;
