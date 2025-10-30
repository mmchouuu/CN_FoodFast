const catalogService = require('../services/catalog.service');

async function listCatalog(req, res, next) {
  try {
    const filters = { ...(req.query || {}) };
    const result = await catalogService.listRestaurantCatalog(filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getCatalog(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const filters = { ...(req.query || {}) };
    const catalog = await catalogService.getRestaurantCatalog(restaurantId, filters);
    if (!catalog) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    return res.json(catalog);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCatalog,
  getCatalog,
};
