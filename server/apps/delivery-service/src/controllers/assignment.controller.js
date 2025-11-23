const assignmentService = require('../services/assignment.service');

async function getMetrics(req, res, next) {
  try {
    const metrics = await assignmentService.getAssignmentMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMetrics,
};
