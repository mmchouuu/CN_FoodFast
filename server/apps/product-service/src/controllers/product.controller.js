const service = require('../services/product.service');

async function list(req,res,next){
  try{
    const limit = parseInt(req.query.limit||20);
    const offset = parseInt(req.query.offset||0);
    const params = { limit, offset };
    if(req.query.restaurant_id){
      params.restaurantId = req.query.restaurant_id;
    }
    const rows = await service.list(params);
    res.json({data: rows});
  }catch(err){ next(err); }
}

async function get(req,res,next){
  try{
    const p = await service.get(req.params.id);
    if(!p) return res.status(404).json({error:'not found'});
    res.json(p);
  }catch(err){ next(err); }
}

async function create(req,res,next){
  try{
    const { restaurant_id, title, base_price } = req.body || {};
    if(!restaurant_id || !title){
      return res.status(400).json({ error: 'restaurant_id and title are required' });
    }
    const payload = { ...req.body };
    if(typeof payload.base_price === 'string'){
      payload.base_price = Number(payload.base_price);
    }
    if(Number.isNaN(payload.base_price)){
      payload.base_price = undefined;
    }
    const created = await service.create(payload);
    res.status(201).json(created);
  }catch(err){ next(err); }
}

async function update(req,res,next){
  try{
    const payload = { ...req.body };
    if(typeof payload.base_price === 'string'){
      payload.base_price = Number(payload.base_price);
    }
    if(Number.isNaN(payload.base_price)){
      delete payload.base_price;
    }
    const updated = await service.update(req.params.id, payload);
    if(!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  }catch(err){ next(err); }
}

async function remove(req,res,next){
  try{
    const deleted = await service.remove(req.params.id);
    if(!deleted) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  }catch(err){ next(err); }
}

module.exports = { list, get, create, update, remove };
