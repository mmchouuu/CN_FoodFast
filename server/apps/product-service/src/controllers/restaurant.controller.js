import {
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
} from '../services/restaurant.service.js';

export async function getRestaurants(req, res) {
  try {
    const data = await getAllRestaurants();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getRestaurant(req, res) {
  try {
    const { id } = req.params;
    const restaurant = await getRestaurantById(id);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getOwnerRestaurants(req, res) {
  try {
    const { ownerId } = req.params;
    const data = await getRestaurantsByOwner(ownerId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getOwnerRestaurantDetail(req, res) {
  try {
    const { ownerId } = req.params;
    const restaurant = await getRestaurantByOwner(ownerId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function addRestaurant(req, res) {
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

export async function editRestaurant(req, res) {
  try {
    const { id } = req.params;
    const updated = await updateRestaurant(id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function removeRestaurant(req, res) {
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

export async function listBranches(req, res) {
  try {
    const { id } = req.params;
    const branches = await getBranchesForRestaurant(id);
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function addBranch(req, res) {
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

export async function editBranch(req, res) {
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

export async function removeBranch(req, res) {
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
