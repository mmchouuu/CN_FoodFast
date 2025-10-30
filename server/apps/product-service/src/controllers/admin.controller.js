const adminService = require('../services/admin.service');
const menuService = require('../services/menu.service');

async function createTaxTemplate(req, res, next) {
  try {
    const template = await adminService.createTaxTemplate(req.body || {});
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
}

async function createCalendar(req, res, next) {
  try {
    const calendar = await adminService.createCalendar(req.body || {});
    res.status(201).json(calendar);
  } catch (error) {
    next(error);
  }
}

async function assignTax(req, res, next) {
  try {
    const assignment = await adminService.assignTax(req.body || {});
    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
}

async function createGlobalPromotion(req, res, next) {
  try {
    const promotion = await menuService.createPromotion({ ...req.body, scopeType: 'global' });
    res.status(201).json(promotion);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTaxTemplate,
  createCalendar,
  assignTax,
  createGlobalPromotion,
};
