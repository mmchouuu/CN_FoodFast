const service = require('../services/order.service');

async function create(req,res,next){
  try{
    const userId = req.user?.userId || req.user?.id;
    const ord = await service.create({ ...req.body, user_id: userId });
    res.status(201).json(ord);
  }catch(err){ next(err); }
}

async function list(req,res,next){
  try{
    const userId = req.user?.userId || req.user?.id;
    const orders = await service.listByUser(userId);
    res.json(orders);
  }catch(err){ next(err); }
}

async function get(req,res,next){
  try{
    const userId = req.user?.userId || req.user?.id;
    const ord = await service.get(req.params.id, userId);
    if(!ord) return res.status(404).json({error:'not found'});
    res.json(ord);
  }catch(err){ next(err); }
}

module.exports = { create, get, list };
