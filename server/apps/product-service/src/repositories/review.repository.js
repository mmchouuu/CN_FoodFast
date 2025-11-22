const { pool } = require('../db');

function getExecutor(client) {
  return client || pool;
}

function normaliseLimit(value, fallback = 20) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.min(numeric, 100);
}

function normaliseOffset(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

async function createRestaurantReview(payload, client) {
  const executor = getExecutor(client);
  const {
    restaurantId,
    branchId = null,
    orderId = null,
    userId = null,
    customerName = null,
    customerPhone = null,
    rating,
    riderRating = null,
    comment = null,
    photos = [],
    metadata = null,
    ownerReply = null,
    ownerReplyBy = null,
    ownerReplyAt = null,
  } = payload;
  const res = await executor.query(
    `
      INSERT INTO restaurant_reviews (
        restaurant_id,
        branch_id,
        order_id,
        user_id,
        customer_name,
        customer_phone,
        rating,
        rider_rating,
        comment,
        photos,
        metadata,
        owner_reply,
        owner_reply_by,
        owner_reply_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `,
    [
      restaurantId,
      branchId,
      orderId,
      userId,
      customerName,
      customerPhone,
      rating,
      riderRating,
      comment,
      Array.isArray(photos) ? photos : [],
      metadata && Object.keys(metadata).length ? metadata : null,
      ownerReply,
      ownerReplyBy,
      ownerReplyAt,
    ],
  );
  return res.rows[0] || null;
}

async function findRestaurantReviewById(reviewId) {
  if (!reviewId) return null;
  const { rows } = await pool.query(
    'SELECT * FROM restaurant_reviews WHERE id = $1 LIMIT 1',
    [reviewId],
  );
  return rows[0] || null;
}

async function updateRestaurantReview(reviewId, fields = {}, client) {
  const executor = getExecutor(client);
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) {
    return findRestaurantReviewById(reviewId);
  }
  const columns = [];
  const values = [];
  entries.forEach(([key, value]) => {
    columns.push(`${key} = $${columns.length + 1}`);
    values.push(value);
  });
  values.push(reviewId);
  const { rows } = await executor.query(
    `
      UPDATE restaurant_reviews
      SET ${columns.join(', ')}, updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  );
  return rows[0] || null;
}

async function createProductReview(payload, client) {
  const executor = getExecutor(client);
  const {
    restaurantReviewId = null,
    restaurantId,
    productId,
    orderId = null,
    userId = null,
    productName = null,
    productImage = null,
    rating,
    comment = null,
    metadata = null,
  } = payload;
  const res = await executor.query(
    `
      INSERT INTO product_reviews (
        restaurant_review_id,
        restaurant_id,
        product_id,
        order_id,
        user_id,
        product_name,
        product_image,
        rating,
        comment,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      restaurantReviewId,
      restaurantId,
      productId,
      orderId,
      userId,
      productName,
      productImage,
      rating,
      comment,
      metadata && Object.keys(metadata).length ? metadata : null,
    ],
  );
  return res.rows[0] || null;
}

async function listRestaurantReviews(restaurantId, options = {}) {
  const limit = normaliseLimit(options.limit, 20);
  const offset = normaliseOffset(options.offset);

  let branchIds = [];
  if (Array.isArray(options.branchIds)) {
    branchIds = options.branchIds.map((id) => id && id.trim()).filter(Boolean);
  } else if (typeof options.branchIds === 'string') {
    branchIds = options.branchIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const params = [restaurantId];
  let filter = 'rr.restaurant_id = $1';

  if (branchIds.length) {
    params.push(branchIds);
    filter += ` AND (rr.branch_id IS NULL OR rr.branch_id = ANY($${params.length}))`;
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `
      SELECT
        rr.*,
        rb.name AS branch_name
      FROM restaurant_reviews rr
      LEFT JOIN restaurant_branches rb ON rb.id = rr.branch_id
      WHERE ${filter}
      ORDER BY rr.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  return rows;
}

async function countRestaurantReviews(restaurantId) {
  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*)::INT AS total,
        COALESCE(AVG(rating), 0)::NUMERIC(4,2) AS average
      FROM restaurant_reviews
      WHERE restaurant_id = $1
    `,
    [restaurantId],
  );
  return rows[0] || { total: 0, average: 0 };
}

async function listProductReviewsByRestaurantReviewIds(reviewIds = []) {
  if (!Array.isArray(reviewIds) || !reviewIds.length) {
    return [];
  }
  const { rows } = await pool.query(
    `
      SELECT *
      FROM product_reviews
      WHERE restaurant_review_id = ANY($1::uuid[])
      ORDER BY created_at DESC
    `,
    [reviewIds],
  );
  return rows;
}

async function listProductReviews(params = {}) {
  const limit = normaliseLimit(params.limit, 20);
  const offset = normaliseOffset(params.offset);
  const filters = [];
  const values = [];

  if (params.productId) {
    filters.push(`product_id = $${filters.length + 1}`);
    values.push(params.productId);
  }
  if (params.restaurantId) {
    filters.push(`restaurant_id = $${filters.length + 1}`);
    values.push(params.restaurantId);
  }

  if (!filters.length) {
    throw new Error('productId or restaurantId is required to list product reviews');
  }

  values.push(limit, offset);
  const { rows } = await pool.query(
    `
      SELECT *
      FROM product_reviews
      WHERE ${filters.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values,
  );
  return rows;
}

async function countProductReviews(params = {}) {
  const filters = [];
  const values = [];

  if (params.productId) {
    filters.push(`product_id = $${filters.length + 1}`);
    values.push(params.productId);
  }
  if (params.restaurantId) {
    filters.push(`restaurant_id = $${filters.length + 1}`);
    values.push(params.restaurantId);
  }

  if (!filters.length) {
    throw new Error('productId or restaurantId is required to summarise product reviews');
  }

  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*)::INT AS total,
        COALESCE(AVG(rating), 0)::NUMERIC(4,2) AS average
      FROM product_reviews
      WHERE ${filters.join(' AND ')}
    `,
    values,
  );
  return rows[0] || { total: 0, average: 0 };
}

async function getRestaurantSummaries(restaurantIds = []) {
  if (!Array.isArray(restaurantIds) || !restaurantIds.length) {
    return {};
  }
  const { rows } = await pool.query(
    `
      SELECT
        restaurant_id,
        COUNT(*)::INT AS review_count,
        COALESCE(AVG(rating), 0)::NUMERIC(4,2) AS avg_rating
      FROM restaurant_reviews
      WHERE restaurant_id = ANY($1::uuid[])
      GROUP BY restaurant_id
    `,
    [restaurantIds],
  );
  return rows.reduce((acc, row) => {
    acc[row.restaurant_id] = {
      reviewCount: Number(row.review_count || 0),
      averageRating: Number(row.avg_rating || 0),
    };
    return acc;
  }, {});
}

async function getProductSummaries(productIds = []) {
  if (!Array.isArray(productIds) || !productIds.length) {
    return {};
  }
  const { rows } = await pool.query(
    `
      SELECT
        product_id,
        COUNT(*)::INT AS review_count,
        COALESCE(AVG(rating), 0)::NUMERIC(4,2) AS avg_rating
      FROM product_reviews
      WHERE product_id = ANY($1::uuid[])
      GROUP BY product_id
    `,
    [productIds],
  );
  return rows.reduce((acc, row) => {
    acc[row.product_id] = {
      reviewCount: Number(row.review_count || 0),
      averageRating: Number(row.avg_rating || 0),
    };
    return acc;
  }, {});
}

async function refreshRestaurantRatingSummary(restaurantId, client) {
  if (!restaurantId) return null;
  const executor = getExecutor(client);
  await executor.query(
    `
      WITH stats AS (
        SELECT
          COALESCE(AVG(rating), 0)::NUMERIC(4,2) AS avg_rating,
          COUNT(*)::INT AS total_ratings
        FROM restaurant_reviews
        WHERE restaurant_id = $1
      )
      UPDATE restaurants
      SET
        avg_branch_rating = stats.avg_rating,
        total_branch_ratings = stats.total_ratings,
        updated_at = now()
      FROM stats
      WHERE restaurants.id = $1
    `,
    [restaurantId],
  );
}

module.exports = {
  createRestaurantReview,
  findRestaurantReviewById,
  updateRestaurantReview,
  createProductReview,
  listRestaurantReviews,
  countRestaurantReviews,
  listProductReviewsByRestaurantReviewIds,
  listProductReviews,
  countProductReviews,
  getRestaurantSummaries,
  getProductSummaries,
  refreshRestaurantRatingSummary,
};
