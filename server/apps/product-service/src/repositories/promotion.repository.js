const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

async function createPromotion({
  scopeType,
  restaurantId = null,
  branchId = null,
  name,
  description = null,
  promoType,
  discountType,
  discountValue,
  maxDiscount = null,
  couponCode = null,
  stackable = false,
  usageLimit = null,
  perUserLimit = null,
  minOrderAmount = null,
  startAt = null,
  endAt = null,
  daysOfWeek = null,
  isActive = true,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO promotions (
        scope_type,
        restaurant_id,
        branch_id,
        name,
        description,
        promo_type,
        discount_type,
        discount_value,
        max_discount,
        coupon_code,
        stackable,
        usage_limit,
        per_user_limit,
        min_order_amount,
        start_at,
        end_at,
        days_of_week,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *
    `,
    [
      scopeType,
      restaurantId,
      branchId,
      name,
      description,
      promoType,
      discountType,
      discountValue,
      maxDiscount,
      couponCode,
      stackable,
      usageLimit,
      perUserLimit,
      minOrderAmount,
      startAt,
      endAt,
      daysOfWeek,
      isActive,
    ],
  );
  return result.rows[0];
}

async function addPromotionTarget({
  promotionId,
  targetType,
  productId = null,
  categoryId = null,
  restaurantId = null,
  branchId = null,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO promotion_targets (
        promotion_id,
        target_type,
        product_id,
        category_id,
        restaurant_id,
        branch_id
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `,
    [promotionId, targetType, productId, categoryId, restaurantId, branchId],
  );
  return result.rows[0];
}

async function addPromotionExclusion({
  promotionId,
  excludeType,
  productId = null,
  categoryId = null,
}, client) {
  const executor = getExecutor(client);
  const result = await executor.query(
    `
      INSERT INTO promotion_exclusions (
        promotion_id,
        exclude_type,
        product_id,
        category_id
      )
      VALUES ($1,$2,$3,$4)
      RETURNING *
    `,
    [promotionId, excludeType, productId, categoryId],
  );
  return result.rows[0];
}

module.exports = {
  createPromotion,
  addPromotionTarget,
  addPromotionExclusion,
};
