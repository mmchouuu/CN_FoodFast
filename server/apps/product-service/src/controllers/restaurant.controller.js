const restaurantService = require('../services/restaurant.service');

async function createRestaurant(req, res, next) {
  try {
    const result = await restaurantService.createRestaurant(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function getRestaurant(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const restaurant = await restaurantService.getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    return res.json(restaurant);
  } catch (error) {
    next(error);
  }
}

async function getByOwner(req, res, next) {
  try {
    const { ownerId } = req.params;
    const restaurant = await restaurantService.getRestaurantDetailsByOwner(ownerId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    return res.json(restaurant);
  } catch (error) {
    next(error);
  }
}

async function listByOwner(req, res, next) {
  try {
    const { ownerId } = req.params;
    const items = await restaurantService.listRestaurantsByOwner(ownerId);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

async function updateRestaurant(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const result = await restaurantService.updateRestaurantDetails(restaurantId, req.body || {});
    if (!result) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createBranch(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const branch = await restaurantService.createBranch(restaurantId, req.body || {});
    res.status(201).json(branch);
  } catch (error) {
    next(error);
  }
}

async function listBranches(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const branches = await restaurantService.listRestaurantBranches(restaurantId);
    res.json(branches);
  } catch (error) {
    next(error);
  }
}

async function updateBranch(req, res, next) {
  try {
    const { restaurantId, branchId } = req.params;
    const branch = await restaurantService.updateBranchDetails(restaurantId, branchId, req.body || {});
    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    res.json(branch);
  } catch (error) {
    next(error);
  }
}

async function deleteBranch(req, res, next) {
  try {
    const { restaurantId, branchId } = req.params;
    const deleted = await restaurantService.deleteBranch(restaurantId, branchId);
    if (!deleted) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function updateBranchSchedules(req, res, next) {
  try {
    const { restaurantId, branchId } = req.params;
    const result = await restaurantService.upsertBranchSchedules(restaurantId, branchId, req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function inviteMember(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const result = await restaurantService.inviteRestaurantMember(restaurantId, req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRestaurant,
  getRestaurant,
  getByOwner,
  listByOwner,
  updateRestaurant,
  createBranch,
  listBranches,
  updateBranch,
  deleteBranch,
  updateBranchSchedules,
  inviteMember,
};
