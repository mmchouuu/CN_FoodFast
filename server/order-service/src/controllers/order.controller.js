const service = require('../services/order.service');

async function create(req,res,next){
  try{
    const ord = await service.create(req.body);
    res.status(201).json(ord);
  }catch(err){ next(err); }
}

async function get(req,res,next){
  try{
    const ord = await service.get(req.params.id);
    if(!ord) return res.status(404).json({error:'not found'});
    res.json(ord);
  }catch(err){ next(err); }
}

module.exports = { create, get };
