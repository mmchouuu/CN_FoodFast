const service = require('../services/payment.service');

async function create(req,res,next){
  try{
    const p = await service.create(req.body);
    res.status(201).json(p);
  }catch(err){ next(err); }
}

async function get(req,res,next){
  try{
    const p = await service.get(req.params.id);
    if(!p) return res.status(404).json({error:'not found'});
    res.json(p);
  }catch(err){ next(err); }
}

module.exports = { create, get };
