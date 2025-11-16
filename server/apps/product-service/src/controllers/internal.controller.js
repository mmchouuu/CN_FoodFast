const internalService = require('../services/internal.service');

async function decrementInventory(req, res, next) {
  try {
    const result = await internalService.decrementInventoryForOrder(req.body || {});
    res.json(result);
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
}

module.exports = {
  decrementInventory,
};
