const { Router } = require('express');
const deliveryController = require('../controllers/delivery.controller');
const droneController = require('../controllers/drone.controller');

const router = Router();

router.get('/', deliveryController.listDeliveries);
router.get('/status', deliveryController.getStatus);
router.get('/drones/summary', droneController.getSummary);
router.get('/drones', droneController.listDrones);
router.post('/drones', droneController.createDrone);
router.put('/drones/:id', droneController.updateDrone);
router.delete('/drones/:id', droneController.deleteDrone);
router.get('/drones/:id/logs', droneController.getDroneLogs);

module.exports = router;
