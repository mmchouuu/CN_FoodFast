// const express = require('express');
// const router = express.Router();
// const ctrl = require('../controllers/order.controller');

// router.post('/', ctrl.create);
// router.get('/:id', ctrl.get);

// module.exports = router;


import express from "express";
import * as OrderController from "../controllers/order.controller.js";

const router = express.Router();


router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.get);

export default router;
