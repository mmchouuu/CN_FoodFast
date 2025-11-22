const { withTransaction } = require('../db');
const restaurantRepository = require('../repositories/restaurant.repository');
const reviewRepository = require('../repositories/review.repository');

function toHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertEntityId(id, field = 'id') {
  if (!id || typeof id !== 'string') {
    throw toHttpError(`${field} is required`, 400);
  }
  const trimmed = id.trim();
  if (!trimmed) {
    throw toHttpError(`${field} is required`, 400);
  }
  return trimmed;
}

async function resolveRestaurantContext({ restaurantId, branchId }) {
  if (!restaurantId && !branchId) {
    throw toHttpError('restaurantId is required', 400);
  }

  let resolvedRestaurantId = restaurantId ? assertEntityId(restaurantId, 'restaurantId') : null;
  let resolvedBranchId = branchId ? assertEntityId(branchId, 'branchId') : null;
  let restaurant = null;
  let branchRecord = null;

  if (resolvedBranchId) {
    branchRecord = await restaurantRepository.findBranchByUuid(resolvedBranchId);
    if (!branchRecord) {
      // Invalid branch id; drop to avoid FK violation
      resolvedBranchId = null;
    }
  }

  if (resolvedRestaurantId) {
    restaurant = await restaurantRepository.findRestaurantById(resolvedRestaurantId);
    if (!restaurant && !branchRecord) {
      // Maybe client sent a branch id as restaurant id
      const possibleBranch = await restaurantRepository.findBranchByUuid(resolvedRestaurantId);
      if (possibleBranch) {
        branchRecord = possibleBranch;
        resolvedBranchId = resolvedBranchId || possibleBranch.id;
        resolvedRestaurantId = possibleBranch.restaurant_id;
        restaurant = await restaurantRepository.findRestaurantById(possibleBranch.restaurant_id);
      }
    }
  }

  if (!restaurant && branchRecord) {
    restaurant = await restaurantRepository.findRestaurantById(branchRecord.restaurant_id);
    resolvedRestaurantId = branchRecord.restaurant_id;
  }

  if (!restaurant) {
    throw toHttpError('Restaurant not found', 404);
  }

  if (resolvedBranchId && branchRecord && branchRecord.restaurant_id !== resolvedRestaurantId) {
    // Branch belongs to another restaurant; ignore branch to avoid FK error
    resolvedBranchId = null;
  }

  return { restaurantId: resolvedRestaurantId, branchId: resolvedBranchId, restaurant };
}

function normalizeRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (numeric < 0 || numeric > 5) {
    return null;
  }
  return Number(numeric.toFixed(2));
}

function mapProductReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    reviewId: row.restaurant_review_id,
    restaurantId: row.restaurant_id,
    productId: row.product_id,
    orderId: row.order_id,
    userId: row.user_id,
    productName: row.product_name,
    productImage: row.product_image,
    rating: Number(row.rating || 0),
    comment: row.comment || '',
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function mapRestaurantReview(row, productReviews = []) {
  if (!row) return null;
  const photos = Array.isArray(row.photos) ? row.photos : [];
  const ownerReply = row.owner_reply || row.ownerReply || null;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    branchId: row.branch_id,
    orderId: row.order_id,
    userId: row.user_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    rating: Number(row.rating || 0),
    riderRating: row.rider_rating === null || row.rider_rating === undefined ? null : Number(row.rider_rating),
    comment: row.comment || '',
    photos,
    metadata: row.metadata || {},
    branchName: row.branch_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerReply,
    ownerReplyAt: row.owner_reply_at || row.ownerReplyAt || null,
    ownerReplyBy: row.owner_reply_by || row.ownerReplyBy || null,
    dishes: productReviews.map(mapProductReview).filter(Boolean),
  };
}

async function createRestaurantReview(restaurantId, payload = {}) {
  const branchIdFromPayload = payload.branchId || payload.branch_id || null;
  const { restaurantId: resolvedRestaurantId, branchId } = await resolveRestaurantContext({
    restaurantId,
    branchId: branchIdFromPayload,
  });

  const rating = normalizeRating(payload.rating);
  if (rating === null) {
    throw toHttpError('rating must be between 0 and 5', 400);
  }

  const riderRating =
    payload.riderRating === undefined || payload.riderRating === null
      ? null
      : normalizeRating(payload.riderRating);
  if (payload.riderRating !== undefined && riderRating === null) {
    throw toHttpError('riderRating must be between 0 and 5', 400);
  }

  const dishes = Array.isArray(payload.dishes) ? payload.dishes : [];
  const restaurantReview = await withTransaction(async (client) => {
    const review = await reviewRepository.createRestaurantReview(
      {
        restaurantId: resolvedRestaurantId,
        branchId,
        orderId: payload.orderId || payload.order_id || null,
        userId: payload.userId || payload.user_id || null,
        customerName: payload.customerName || payload.customer_name || null,
        customerPhone: payload.customerPhone || payload.customer_phone || null,
        rating,
        riderRating,
        comment: payload.comment || null,
        photos: payload.photos || [],
        metadata: payload.metadata || null,
      },
      client,
    );

    for (const item of dishes) {
      if (!item || !item.productId) continue;
      const itemRating = normalizeRating(item.rating ?? item.score ?? 0);
      if (itemRating === null) continue;
      // eslint-disable-next-line no-await-in-loop
      await reviewRepository.createProductReview(
        {
          restaurantReviewId: review.id,
          restaurantId: resolvedRestaurantId,
          productId: item.productId,
          orderId: payload.orderId || null,
          userId: payload.userId || null,
          productName: item.productName || item.product_name || null,
          productImage: item.productImage || item.product_image || null,
          rating: itemRating,
          comment: item.comment || null,
          metadata: item.metadata || null,
        },
        client,
      );
    }

    return review;
  });
  await reviewRepository.refreshRestaurantRatingSummary(resolvedRestaurantId);

  const reviewIds = restaurantReview ? [restaurantReview.id] : [];
  const productRows = await reviewRepository.listProductReviewsByRestaurantReviewIds(reviewIds);
  const mapped = mapRestaurantReview(restaurantReview, productRows);
  const summary = await reviewRepository.countRestaurantReviews(resolvedRestaurantId);

  return {
    review: mapped,
    summary: {
      averageRating: Number(summary.average || 0),
      totalReviews: Number(summary.total || 0),
    },
  };
}

async function replyToRestaurantReview(restaurantId, reviewId, payload = {}) {
  const branchIdFromPayload = payload.branchId || payload.branch_id || null;
  const { restaurantId: resolvedRestaurantId } = await resolveRestaurantContext({
    restaurantId,
    branchId: branchIdFromPayload,
  });
  if (!reviewId) {
    throw toHttpError('reviewId is required', 400);
  }
  const existing = await reviewRepository.findRestaurantReviewById(reviewId);
  if (!existing) {
    throw toHttpError('Review not found', 404);
  }
  if (existing.restaurant_id !== resolvedRestaurantId) {
    throw toHttpError('Review does not belong to this restaurant', 403);
  }
  const rawReply = payload.reply || payload.message || payload.response || '';
  const trimmedReply = typeof rawReply === 'string' ? rawReply.trim() : '';
  if (!trimmedReply) {
    throw toHttpError('reply text is required', 400);
  }
  const ownerUserId = payload.ownerUserId || payload.owner_user_id || null;
  const updated = await reviewRepository.updateRestaurantReview(existing.id, {
    owner_reply: trimmedReply,
    owner_reply_at: new Date().toISOString(),
    owner_reply_by: ownerUserId || existing.owner_reply_by || null,
  });

  const productRows = await reviewRepository.listProductReviewsByRestaurantReviewIds([existing.id]);
  const mapped = mapRestaurantReview(updated, productRows);
  return { review: mapped };
}

async function listRestaurantReviews(restaurantId, options = {}) {
  const { restaurantId: resolvedRestaurantId } = await resolveRestaurantContext({
    restaurantId,
  });
  const rows = await reviewRepository.listRestaurantReviews(resolvedRestaurantId, options);
  const reviewIds = rows.map((row) => row.id);
  const productRows = await reviewRepository.listProductReviewsByRestaurantReviewIds(reviewIds);
  const productMap = productRows.reduce((acc, row) => {
    const list = acc.get(row.restaurant_review_id) || [];
    list.push(row);
    acc.set(row.restaurant_review_id, list);
    return acc;
  }, new Map());
  const reviews = rows.map((row) =>
    mapRestaurantReview(row, productMap.get(row.id) || []),
  );
  const summary = await reviewRepository.countRestaurantReviews(resolvedRestaurantId);
  return {
    reviews,
    summary: {
      averageRating: Number(summary.average || 0),
      totalReviews: Number(summary.total || 0),
    },
  };
}

async function listProductReviews(productId, options = {}) {
  if (!productId || typeof productId !== 'string') {
    throw toHttpError('productId is required', 400);
  }
  const params = {
    productId: productId.trim(),
  };
  if (options.restaurantId) {
    params.restaurantId = options.restaurantId;
  }
  const rows = await reviewRepository.listProductReviews({
    ...params,
    limit: options.limit,
    offset: options.offset,
  });
  const summary = await reviewRepository.countProductReviews(params);
  return {
    reviews: rows.map(mapProductReview).filter(Boolean),
    summary: {
      averageRating: Number(summary.average || 0),
      totalReviews: Number(summary.total || 0),
    },
  };
}

module.exports = {
  createRestaurantReview,
  replyToRestaurantReview,
  listRestaurantReviews,
  listProductReviews,
};
