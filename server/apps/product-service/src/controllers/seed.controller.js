const seedService = require('../services/seed.service');

async function seedSample(req, res, next) {
  try {
    const result = await seedService.seedSampleData();
    res.status(201).json({
      message: 'Sample restaurants and products created successfully.',
      counts: {
        restaurants: result.restaurants.length,
        products: result.products.length,
      },
      restaurants: result.restaurants,
      products: result.products,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  seedSample,
};
