// const service = require('../services/order.service');

// async function create(req,res,next){
//   try{
//     const ord = await service.create(req.body);
//     res.status(201).json(ord);
//   }catch(err){ next(err); }
// }

// async function get(req,res,next){
//   try{
//     const ord = await service.get(req.params.id);
//     if(!ord) return res.status(404).json({error:'not found'});
//     res.json(ord);
//   }catch(err){ next(err); }
// }

// module.exports = { create, get };

import * as OrderService from "../services/order.service.js";

export const getAllOrders = async (req, res) => {
  try {
    const orders = await OrderService.getAllOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await OrderService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createOrder = async (req, res) => {
  try {
    const order = await OrderService.createOrder(req.body);
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const order = await OrderService.updateOrderStatus(req.params.id, req.body.status);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const result = await OrderService.deleteOrder(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getOrdersByUser = async (req, res) => {
  try {
    const orders = await OrderService.getOrdersByUserId(req.params.userId);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
