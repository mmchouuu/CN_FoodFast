import express from 'express';
import * as productController from '../controllers/product.controller.js';
import {
  listRestaurantInventory,
  listProductInventory,
  listBranchInventory,
  upsertBranchInventory,
} from '../controllers/inventory.controller.js';

const productRouter = express.Router();

productRouter.get('/', productController.list);
productRouter.post('/', productController.create);
productRouter.get('/:id', productController.get);
productRouter.patch('/:id', productController.update);
productRouter.delete('/:id', productController.remove);

const categoriesRouter = express.Router({ mergeParams: true });
categoriesRouter.get('/', productController.listCategories);
categoriesRouter.post('/', productController.createCategory);
categoriesRouter.patch('/:categoryId', productController.updateCategory);
categoriesRouter.delete('/:categoryId', productController.removeCategory);

const restaurantProductsRouter = express.Router({ mergeParams: true });
restaurantProductsRouter.get('/', productController.list);
restaurantProductsRouter.post('/', productController.create);
restaurantProductsRouter.get('/:id', productController.get);
restaurantProductsRouter.patch('/:id', productController.update);
restaurantProductsRouter.delete('/:id', productController.remove);

const restaurantInventoryRouter = express.Router({ mergeParams: true });
restaurantInventoryRouter.get('/', listRestaurantInventory);

const productInventoryRouter = express.Router({ mergeParams: true });
productInventoryRouter.get('/', listProductInventory);

const branchInventoryRouter = express.Router({ mergeParams: true });
branchInventoryRouter.get('/', listBranchInventory);
branchInventoryRouter.put('/:productId', upsertBranchInventory);

export {
  categoriesRouter,
  restaurantProductsRouter,
  restaurantInventoryRouter,
  productInventoryRouter,
  branchInventoryRouter,
};

export default productRouter;
