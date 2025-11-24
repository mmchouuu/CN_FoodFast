const catalogService = require('../services/catalog.service');

async function listCatalog(req, res, next) {
  try {
    const filters = { ...(req.query || {}) };
    // Allow passing customer coordinates via headers if gateway/proxy adds them
    const headerLat =
      req.headers['x-lat'] ||
      req.headers['x-latitude'] ||
      req.headers['customer-lat'] ||
      req.headers['customer-latitude'];
    const headerLng =
      req.headers['x-lng'] ||
      req.headers['x-longitude'] ||
      req.headers['customer-lng'] ||
      req.headers['customer-longitude'];
    if (headerLat !== undefined && filters.lat === undefined && filters.latitude === undefined) {
      filters.lat = headerLat;
    }
    if (headerLng !== undefined && filters.lng === undefined && filters.longitude === undefined) {
      filters.lng = headerLng;
    }
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
    const headerLat =
      req.headers['x-lat'] ||
      req.headers['x-latitude'] ||
      req.headers['customer-lat'] ||
      req.headers['customer-latitude'];
    const headerLng =
      req.headers['x-lng'] ||
      req.headers['x-longitude'] ||
      req.headers['customer-lng'] ||
      req.headers['customer-longitude'];
    if (headerLat !== undefined && filters.lat === undefined && filters.latitude === undefined) {
      filters.lat = headerLat;
    }
    if (headerLng !== undefined && filters.lng === undefined && filters.longitude === undefined) {
      filters.lng = headerLng;
    }
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
