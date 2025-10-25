const express = require('express');
const controller = require('../controllers/restaurants.controller');

const router = express.Router();

router.get('/', controller.listCategories);
router.post('/', controller.createCategory);
router.patch('/:categoryId', controller.updateCategory);
router.delete('/:categoryId', controller.deleteCategory);

module.exports = router;
