const menuService = require('../services/menu.service');

async function createCategory(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const payload = { ...req.body };
    const category = await menuService.createCategory(restaurantId, payload);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
}

async function listCategories(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const categories = await menuService.listCategories(restaurantId, req.query || {});
    res.json(categories);
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const product = await menuService.createProduct(restaurantId, req.body || {});
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

async function listProducts(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const filters = { ...(req.query || {}) };
    const products = await menuService.listProducts(restaurantId, filters);
    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    const product = await menuService.updateProduct(restaurantId, productId, req.body || {});
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    await menuService.deleteProduct(restaurantId, productId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function listInventory(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    const inventory = await menuService.listProductInventory(restaurantId, productId);
    res.json(inventory);
  } catch (error) {
    next(error);
  }
}

async function updateInventory(req, res, next) {
  try {
    const { restaurantId, branchId, productId } = req.params;
    const result = await menuService.updateProductInventory(
      restaurantId,
      branchId,
      productId,
      req.body || {},
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createOptionGroup(req, res, next) {
  try {
    const { restaurantId, productId } = req.params;
    const payload = { ...req.body, restaurantId };
    const group = await menuService.createOptionGroupForProduct(productId, payload);
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
}

async function createCombo(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const combo = await menuService.createCombo(restaurantId, req.body || {});
    res.status(201).json(combo);
  } catch (error) {
    next(error);
  }
}

async function createPromotion(req, res, next) {
  try {
    const { restaurantId } = req.params;
    const payload = {
      restaurantId,
      ...req.body,
    };
    if (!payload.scopeType) {
      payload.scopeType = restaurantId ? 'restaurant' : 'global';
    }
    if (payload.scopeType === 'branch' && !payload.branchId && req.body?.branchId) {
      payload.branchId = req.body.branchId;
    }
    const promotion = await menuService.createPromotion(payload);
    res.status(201).json(promotion);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCategory,
  listCategories,
  createProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  listInventory,
  updateInventory,
  createOptionGroup,
  createCombo,
  createPromotion,
};
