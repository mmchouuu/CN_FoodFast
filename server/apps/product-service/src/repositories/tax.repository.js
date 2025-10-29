const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

async function createTaxTemplate({ code, name, description = null }, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO tax_templates (code, name, description)
      VALUES ($1,$2,$3)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
      RETURNING *
    `,
    [code, name, description],
  );
  return result.rows[0];
}

async function createCalendar({ code, name, description = null }, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO calendars (code, name, description)
      VALUES ($1,$2,$3)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
      RETURNING *
    `,
    [code, name, description],
  );
  return result.rows[0];
}

async function addCalendarDate({ calendarId, date, name = null, note = null }, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO calendar_dates (
        calendar_id,
        date,
        name,
        note
      )
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (calendar_id, date)
      DO UPDATE SET
        name = EXCLUDED.name,
        note = EXCLUDED.note,
        updated_at = now()
      RETURNING *
    `,
    [calendarId, date, name, note],
  );
  return result.rows[0];
}

async function assignTaxToRestaurant({
  restaurantId,
  taxTemplateId,
  rate,
  ratePercent,
  isDefault = false,
  priority = 100,
  calendarId = null,
  startAt,
  endAt,
  effectiveFrom = null,
  effectiveTo = null,
  isActive = true,
}, client) {
  const executor = getExecutor(client);
  const resolvedRate =
    ratePercent !== undefined && ratePercent !== null ? ratePercent : rate ?? null;
  const start =
    startAt !== undefined ? startAt : effectiveFrom !== undefined ? effectiveFrom : null;
  const end = endAt !== undefined ? endAt : effectiveTo !== undefined ? effectiveTo : null;
  const finalRate = resolvedRate === null || resolvedRate === undefined ? null : Number(resolvedRate);
  const finalPriority =
    priority === undefined || priority === null ? 100 : Number(priority);

  const result = await executor.query(
    `
      INSERT INTO restaurant_tax_assignments (
        restaurant_id,
        tax_template_id,
        rate_percent,
        is_default,
        calendar_id,
        start_at,
        end_at,
        priority,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (restaurant_id, tax_template_id)
      DO UPDATE SET
        rate_percent = EXCLUDED.rate_percent,
        is_default = EXCLUDED.is_default,
        calendar_id = EXCLUDED.calendar_id,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        priority = EXCLUDED.priority,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING *
    `,
    [
      restaurantId,
      taxTemplateId,
      finalRate,
      isDefault === true,
      calendarId,
      start,
      end,
      finalPriority,
      isActive !== false,
    ],
  );
  return result.rows[0];
}

async function assignTaxToBranch({
  branchId,
  taxTemplateId,
  rate,
  ratePercent,
  isDefault = false,
  priority = 100,
  calendarId = null,
  startAt,
  endAt,
  effectiveFrom = null,
  effectiveTo = null,
  isActive = true,
}, client) {
  const executor = getExecutor(client);
  const resolvedRate =
    ratePercent !== undefined && ratePercent !== null ? ratePercent : rate ?? null;
  const start =
    startAt !== undefined ? startAt : effectiveFrom !== undefined ? effectiveFrom : null;
  const end = endAt !== undefined ? endAt : effectiveTo !== undefined ? effectiveTo : null;
  const finalRate = resolvedRate === null || resolvedRate === undefined ? null : Number(resolvedRate);
  const finalPriority =
    priority === undefined || priority === null ? 100 : Number(priority);

  const result = await executor.query(
    `
      INSERT INTO branch_tax_assignments (
        branch_id,
        tax_template_id,
        rate_percent,
        is_default,
        calendar_id,
        start_at,
        end_at,
        priority,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (branch_id, tax_template_id)
      DO UPDATE SET
        rate_percent = EXCLUDED.rate_percent,
        is_default = EXCLUDED.is_default,
        calendar_id = EXCLUDED.calendar_id,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        priority = EXCLUDED.priority,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING *
    `,
    [
      branchId,
      taxTemplateId,
      finalRate,
      isDefault === true,
      calendarId,
      start,
      end,
      finalPriority,
      isActive !== false,
    ],
  );
  return result.rows[0];
}

async function overrideProductTax({
  productId,
  taxTemplateId,
  rate,
  ratePercent,
  priority = 50,
  startAt,
  endAt,
  effectiveFrom = null,
  effectiveTo = null,
  isActive = true,
}, client) {
  const executor = getExecutor(client);
  const resolvedRate =
    ratePercent !== undefined && ratePercent !== null ? ratePercent : rate ?? null;
  const start =
    startAt !== undefined ? startAt : effectiveFrom !== undefined ? effectiveFrom : null;
  const end = endAt !== undefined ? endAt : effectiveTo !== undefined ? effectiveTo : null;
  const finalRate = resolvedRate === null || resolvedRate === undefined ? null : Number(resolvedRate);
  const finalPriority =
    priority === undefined || priority === null ? 50 : Number(priority);

  const result = await executor.query(
    `
      INSERT INTO product_tax_overrides (
        product_id,
        tax_template_id,
        rate_percent,
        start_at,
        end_at,
        priority,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `,
    [
      productId,
      taxTemplateId,
      finalRate,
      start,
      end,
      finalPriority,
      isActive !== false,
    ],
  );
  return result.rows[0];
}

async function overrideBranchProductTax({
  branchId,
  productId,
  taxTemplateId,
  rate,
  ratePercent,
  priority = 40,
  startAt,
  endAt,
  effectiveFrom = null,
  effectiveTo = null,
  isActive = true,
}, client) {
  const executor = getExecutor(client);
  const resolvedRate =
    ratePercent !== undefined && ratePercent !== null ? ratePercent : rate ?? null;
  const start =
    startAt !== undefined ? startAt : effectiveFrom !== undefined ? effectiveFrom : null;
  const end = endAt !== undefined ? endAt : effectiveTo !== undefined ? effectiveTo : null;
  const finalRate = resolvedRate === null || resolvedRate === undefined ? null : Number(resolvedRate);
  const finalPriority =
    priority === undefined || priority === null ? 40 : Number(priority);

  const result = await executor.query(
    `
      INSERT INTO branch_product_tax_overrides (
        branch_id,
        product_id,
        tax_template_id,
        rate_percent,
        start_at,
        end_at,
        priority,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `,
    [
      branchId,
      productId,
      taxTemplateId,
      finalRate,
      start,
      end,
      finalPriority,
      isActive !== false,
    ],
  );
  return result.rows[0];
}

async function listRestaurantTaxAssignments(restaurantId, client) {
  if (!restaurantId) return [];
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM restaurant_tax_assignments
      WHERE restaurant_id = $1
        AND is_active = TRUE
      ORDER BY priority ASC
    `,
    [restaurantId],
  );
  return result.rows;
}

async function listBranchTaxAssignments(branchIds = [], client) {
  if (!Array.isArray(branchIds) || !branchIds.length) return [];
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM branch_tax_assignments
      WHERE branch_id = ANY($1::uuid[])
        AND is_active = TRUE
      ORDER BY branch_id, priority ASC
    `,
    [branchIds],
  );
  return result.rows;
}

async function listBranchProductTaxOverrides(branchIds = [], productIds = [], client) {
  if (
    !Array.isArray(branchIds) ||
    !branchIds.length ||
    !Array.isArray(productIds) ||
    !productIds.length
  ) {
    return [];
  }
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      SELECT *
      FROM branch_product_tax_overrides
      WHERE branch_id = ANY($1::uuid[])
        AND product_id = ANY($2::uuid[])
        AND is_active = TRUE
      ORDER BY branch_id, product_id, priority ASC
    `,
    [branchIds, productIds],
  );
  return result.rows;
}

module.exports = {
  createTaxTemplate,
  createCalendar,
  addCalendarDate,
  assignTaxToRestaurant,
  assignTaxToBranch,
  overrideProductTax,
  overrideBranchProductTax,
  listRestaurantTaxAssignments,
  listBranchTaxAssignments,
  listBranchProductTaxOverrides,
};
