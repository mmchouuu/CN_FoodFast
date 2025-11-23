const { Router } = require('express');
const deliveryController = require('../controllers/delivery.controller');
const droneController = require('../controllers/drone.controller');
const droneHubController = require('../controllers/drone-hub.controller');

const router = Router();

router.get('/', deliveryController.listDeliveries);
router.get('/status', deliveryController.getStatus);
router.get('/admin/drone-hubs/system-summary', droneHubController.getSystemSummary);
router.get('/admin/drone-hubs', droneHubController.listHubs);
router.get('/admin/drone-hubs/:hubId/overview', droneHubController.getHubOverview);
router.get('/drones/summary', droneController.getSummary);
router.get('/drones', droneController.listDrones);
router.post('/drones', droneController.createDrone);
router.put('/drones/:id', droneController.updateDrone);
router.delete('/drones/:id', droneController.deleteDrone);
router.get('/drones/:id/logs', droneController.getDroneLogs);

module.exports = router;
