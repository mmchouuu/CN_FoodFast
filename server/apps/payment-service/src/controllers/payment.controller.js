const service = require('../services/payment.service');

async function create(req,res,next){
  try{
    const userId = req.user?.userId || req.user?.id;
    const authHeader = req.headers.authorization || req.headers.Authorization || null;
    const p = await service.create(
      { ...req.body, user_id: userId },
      { authorization: authHeader }
    );
    res.status(201).json(p);
  }catch(err){ next(err); }
}

async function get(req,res,next){
  try{
    const userId = req.user?.userId || req.user?.id;
    const p = await service.get(req.params.id, userId);
    if(!p) return res.status(404).json({error:'not found'});
    res.json(p);
  }catch(err){ next(err); }
}

module.exports = { create, get };
