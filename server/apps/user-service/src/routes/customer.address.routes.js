const express = require('express');
const auth = require('../middlewares/auth');
const controller = require('../controllers/address.controller');

const router = express.Router();

router.use(auth);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/default', controller.setDefault);

module.exports = router;
