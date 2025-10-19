import express from 'express';
import * as ctrl from '../controllers/product.controller.js';

const router = express.Router();

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.get);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
