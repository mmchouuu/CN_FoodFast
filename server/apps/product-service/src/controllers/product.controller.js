// const service = require('../services/product.service');

// async function list(req,res,next){
//   try{
//     const limit = parseInt(req.query.limit||20);
//     const offset = parseInt(req.query.offset||0);
//     const rows = await service.list({limit, offset});
//     res.json({data: rows});
//   }catch(err){ next(err); }
// }

// async function get(req,res,next){
//   try{
//     const p = await service.get(req.params.id);
//     if(!p) return res.status(404).json({error:'not found'});
//     res.json(p);
//   }catch(err){ next(err); }
// }

// module.exports = { list, get };




// import * as ProductService from '../services/product.service.js';

// export async function getProducts(req, res) {
//   try {
//     const products = await ProductService.getAllProducts();
//     res.json(products);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }

// export async function createProduct(req, res) {
//   try {
//     const product = await ProductService.createProduct(req.body);
//     res.status(201).json(product);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }


// src/controllers/product.controller.js
import * as ProductService from "../services/product.service.js";

export const getAllProducts = async (req, res) => {
  try {
    const products = await ProductService.getAllProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await ProductService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const newProduct = await ProductService.createProduct(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// export const updateProduct = async (req, res) => {
//   try {
//     const updated = await ProductService.updateProduct(req.params.id, req.body);
//     res.json(updated);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Lấy dữ liệu cũ từ DB
    const existing = await ProductService.getProductById(id);
    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Chỉ cập nhật field có trong req.body
    const updatedData = {
      ...existing,
      ...data,
      updated_at: new Date()
    };

    const result = await ProductService.updateProduct(id, updatedData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    await ProductService.deleteProduct(req.params.id);
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
