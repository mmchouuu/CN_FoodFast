const droneHubService = require('../services/droneHubs.service');

async function getSystemSummary(req, res, next) {
  try {
    const summary = await droneHubService.getSystemSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

async function listHubs(req, res, next) {
  try {
    const hubs = await droneHubService.listHubsWithStats();
    res.json({ data: hubs });
  } catch (error) {
    next(error);
  }
}

async function getHubOverview(req, res, next) {
  try {
    const { hubId } = req.params;
    const payload = await droneHubService.getHubOverview(hubId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSystemSummary,
  listHubs,
  getHubOverview,
};
