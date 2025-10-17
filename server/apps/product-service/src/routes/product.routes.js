// const express = require('express');
// const router = express.Router();
// const ctrl = require('../controllers/product.controller');

// router.get('/', ctrl.list);
// router.get('/:id', ctrl.get);

// module.exports = router;



// import express from 'express';
// import { getProducts, createProduct } from '../controllers/product.controller.js';

// const router = express.Router();

// router.get('/', getProducts);
// router.post('/', createProduct);

// export default router;


// src/routes/product.routes.js
import express from "express";
import * as ProductController from "../controllers/product.controller.js";

const router = express.Router();

router.get("/", ProductController.getAllProducts);
router.get("/:id", ProductController.getProductById);
router.post("/", ProductController.createProduct);
router.put("/:id", ProductController.updateProduct);
router.delete("/:id", ProductController.deleteProduct);

export default router;
