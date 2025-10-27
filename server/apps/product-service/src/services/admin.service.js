const { withTransaction } = require('../db');
const taxRepository = require('../repositories/tax.repository');
const { publishSocketEvent } = require('../utils/rabbitmq');

function assert(value, message) {
  if (!value) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
}

async function createTaxTemplate(payload = {}) {
  assert(payload.code, 'code is required');
  assert(payload.name, 'name is required');
  const template = await taxRepository.createTaxTemplate(payload);
  publishSocketEvent('catalog.tax.template.created', { template }, ['admin:catalog']);
  return template;
}

async function createCalendar(payload = {}) {
  assert(payload.code, 'code is required');
  assert(payload.name, 'name is required');
  const calendar = await withTransaction(async (client) => {
    const calendarRow = await taxRepository.createCalendar(payload, client);
    if (Array.isArray(payload.dates)) {
      for (const datePayload of payload.dates) {
        // eslint-disable-next-line no-await-in-loop
        await taxRepository.addCalendarDate(
          {
            calendarId: calendarRow.id,
            date: datePayload.date,
            name: datePayload.name || null,
            note: datePayload.note || null,
          },
          client,
        );
      }
    }
    return calendarRow;
  });

  publishSocketEvent('catalog.calendar.created', { calendar }, ['admin:catalog']);
  return calendar;
}

async function assignTax(payload = {}) {
  assert(payload.taxTemplateId, 'taxTemplateId is required');
  assert(payload.scope, 'scope is required');

  const numericRate =
    payload.rate === undefined || payload.rate === null ? null : Number(payload.rate);
  if (numericRate !== null && !Number.isFinite(numericRate)) {
    const err = new Error('rate must be numeric');
    err.status = 400;
    throw err;
  }

  const scope = payload.scope;

  return withTransaction(async (client) => {
    if (scope === 'restaurant') {
      assert(payload.restaurantId, 'restaurantId required for restaurant scope');
      const assignment = await taxRepository.assignTaxToRestaurant(
        {
          restaurantId: payload.restaurantId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
          effectiveFrom: payload.effectiveFrom || null,
          effectiveTo: payload.effectiveTo || null,
        },
        client,
      );
      publishSocketEvent(
        'catalog.tax.assignment.created',
        {
          scope: 'restaurant',
          restaurantId: payload.restaurantId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
        },
        [`restaurant:${payload.restaurantId}`],
      );
      return assignment;
    }

    if (scope === 'branch') {
      assert(payload.branchId, 'branchId required for branch scope');
      const assignment = await taxRepository.assignTaxToBranch(
        {
          branchId: payload.branchId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
          effectiveFrom: payload.effectiveFrom || null,
          effectiveTo: payload.effectiveTo || null,
        },
        client,
      );
      publishSocketEvent(
        'catalog.tax.assignment.created',
        {
          scope: 'branch',
          branchId: payload.branchId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
        },
        [`restaurant-branch:${payload.branchId}`],
      );
      return assignment;
    }

    if (scope === 'product') {
      assert(payload.productId, 'productId required for product scope');
      const assignment = await taxRepository.overrideProductTax(
        {
          productId: payload.productId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
          effectiveFrom: payload.effectiveFrom || null,
          effectiveTo: payload.effectiveTo || null,
        },
        client,
      );
      publishSocketEvent(
        'catalog.tax.assignment.created',
        {
          scope: 'product',
          productId: payload.productId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
        },
      );
      return assignment;
    }

    if (scope === 'branch_product') {
      assert(payload.branchId, 'branchId required for branch_product scope');
      assert(payload.productId, 'productId required for branch_product scope');
      const assignment = await taxRepository.overrideBranchProductTax(
        {
          branchId: payload.branchId,
          productId: payload.productId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
          effectiveFrom: payload.effectiveFrom || null,
          effectiveTo: payload.effectiveTo || null,
        },
        client,
      );
      publishSocketEvent(
        'catalog.tax.assignment.created',
        {
          scope: 'branch_product',
          branchId: payload.branchId,
          productId: payload.productId,
          taxTemplateId: payload.taxTemplateId,
          rate: numericRate,
        },
        [`restaurant-branch:${payload.branchId}`],
      );
      return assignment;
    }

    const error = new Error('Unsupported scope provided');
    error.status = 400;
    throw error;
  });
}

module.exports = {
  createTaxTemplate,
  createCalendar,
  assignTax,
};
