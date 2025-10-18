const service = require('../services/restaurant.service');

async function create(req, res, next){
  try{
    const { owner_id, name } = req.body || {};
    if(!owner_id || !name){
      return res.status(400).json({ error: 'owner_id and name are required' });
    }
    const created = await service.create(req.body);
    res.status(201).json(created);
  }catch(err){ next(err); }
}

async function list(req, res, next){
  try{
    const limit = parseInt(req.query.limit||20);
    const offset = parseInt(req.query.offset||0);
    const params = { limit, offset };
    if(req.query.owner_id){
      params.ownerId = req.query.owner_id;
    }
    const rows = await service.list(params);
    res.json({ data: rows });
  }catch(err){ next(err); }
}

async function get(req, res, next){
  try{
    const restaurant = await service.get(req.params.id);
    if(!restaurant) return res.status(404).json({ error: 'not found' });
    res.json(restaurant);
  }catch(err){ next(err); }
}

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return undefined;
};

async function update(req, res, next){
  try{
    const payload = { ...req.body };
    if (typeof payload.images === 'string') {
      payload.images = [payload.images];
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) {
      const parsed = parseBoolean(payload.is_active);
      if (typeof parsed === 'undefined') {
        delete payload.is_active;
      } else {
        payload.is_active = parsed;
      }
    }
    const updated = await service.update(req.params.id, payload);
    if(!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  }catch(err){ next(err); }
}

async function remove(req, res, next){
  try{
    const deleted = await service.remove(req.params.id);
    if(!deleted) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  }catch(err){ next(err); }
}

module.exports = { create, list, get, update, remove };
