const {
  createRestaurant,
  createRestaurantBranch,
  deleteRestaurant,
  deleteRestaurantBranch,
  getAllRestaurants,
  getBranchesForRestaurant,
  getRestaurantById,
  getRestaurantByOwner,
  getRestaurantsByOwner,
  updateRestaurant,
  updateRestaurantBranch,
} = require('../services/restaurant.service');

async function getRestaurants(req, res) {
  try {
    const data = await getAllRestaurants();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getRestaurant(req, res) {
  try {
    const { id } = req.params;
    const restaurant = await getRestaurantById(id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getOwnerRestaurants(req, res) {
  try {
    const { ownerId } = req.params;
    const data = await getRestaurantsByOwner(ownerId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getOwnerRestaurantDetail(req, res) {
  try {
    const { ownerId } = req.params;
    const restaurant = await getRestaurantByOwner(ownerId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addRestaurant(req, res) {
  try {
    if (!req.body?.ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }
    if (!req.body?.name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const newRestaurant = await createRestaurant(req.body);
    res.status(201).json(newRestaurant);
  } catch (err) {
    const message = err?.message || 'Internal server error';
    if (message === 'Owner account not found') {
      return res.status(404).json({ error: message });
    }
    if (message === 'ownerId is required' || message === 'Restaurant name is required') {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
}

async function editRestaurant(req, res) {
  try {
    const { id } = req.params;
    const updated = await updateRestaurant(id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function removeRestaurant(req, res) {
  try {
    const { id } = req.params;
    const result = await deleteRestaurant(id);
    if (!result) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listBranches(req, res) {
  try {
    const { id } = req.params;
    const branches = await getBranchesForRestaurant(id);
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addBranch(req, res) {
  try {
    const { id } = req.params;
    if (!req.body?.name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    const branch = await createRestaurantBranch(id, req.body);
    res.status(201).json(branch);
  } catch (err) {
    const message = err?.message || 'Internal server error';
    if (message === 'Restaurant not found') {
      return res.status(404).json({ error: message });
    }
    if (message === 'Branch name is required') {
      return res.status(400).json({ error: message });
    }
    if (message === 'Branch number already exists for this restaurant') {
      return res.status(409).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
}

async function editBranch(req, res) {
  try {
    const { id, branchId } = req.params;
    const branch = await updateRestaurantBranch(id, branchId, req.body);
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.json(branch);
  } catch (err) {
    const message = err?.message || 'Internal server error';
    if (message === 'Branch not found for this restaurant') {
      return res.status(404).json({ error: message });
    }
    if (message === 'Branch number already exists for this restaurant') {
      return res.status(409).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
}

async function removeBranch(req, res) {
  try {
    const { id, branchId } = req.params;
    const result = await deleteRestaurantBranch(id, branchId);
    if (!result) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    res.json(result);
  } catch (err) {
    const message = err?.message || 'Internal server error';
    if (message === 'Branch not found for this restaurant') {
      return res.status(404).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
}

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

module.exports = {
  getRestaurants,
  getRestaurant,
  getOwnerRestaurants,
  getOwnerRestaurantDetail,
  addRestaurant,
  editRestaurant,
  removeRestaurant,
  listBranches,
  addBranch,
  editBranch,
  removeBranch,
  create,
  list,
  get,
  update,
  remove,
};

