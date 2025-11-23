const droneService = require('../services/drones.service');

const respond = (res, payload, status = 200) => res.status(status).json(payload);

async function getSummary(req, res, next) {
  try {
    const summary = await droneService.getSummary({
      branchId: req.query?.branchId || req.query?.branch_id || null,
    });
    respond(res, summary);
  } catch (error) {
    next(error);
  }
}

async function listDrones(req, res, next) {
  try {
    const drones = await droneService.listDrones({
      branchId: req.query?.branchId || req.query?.branch_id || null,
    });
    respond(res, { data: drones });
  } catch (error) {
    next(error);
  }
}

async function createDrone(req, res, next) {
  try {
    const payload = req.body || {};
    const drone = await droneService.createDrone(payload);
    respond(res, drone, 201);
  } catch (error) {
    next(error);
  }
}

async function updateDrone(req, res, next) {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const drone = await droneService.updateDrone(id, payload);
    respond(res, drone);
  } catch (error) {
    next(error);
  }
}

async function deleteDrone(req, res, next) {
  try {
    const { id } = req.params;
    const result = await droneService.deleteDrone(id);
    respond(res, result);
  } catch (error) {
    next(error);
  }
}

async function getDroneLogs(req, res, next) {
  try {
    const { id } = req.params;
    const logs = await droneService.getDroneLogs(id);
    respond(res, { data: logs });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSummary,
  listDrones,
  createDrone,
  updateDrone,
  deleteDrone,
  getDroneLogs,
};
