const express = require('express');
const attachOwnerContext = require('../middlewares/ownerContext');
const paymentOwnerClient = require('../services/payment.owner.client');
const restaurantClient = require('../services/restaurant.client');

const router = express.Router();

const formatBranchLocation = (branch) => {
  if (!branch) return null;
  const parts = [branch.city || branch.branch_city, branch.district || branch.branch_district, branch.street || branch.branch_street]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
};

router.get('/', attachOwnerContext, async (req, res, next) => {
  try {
    const ownerRestaurants = req.ownerContext?.restaurantIds || [];
    const targetRestaurantId = req.query.restaurant_id || ownerRestaurants[0];
    if (!targetRestaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' });
    }

    const headers = {
      Authorization: req.headers.authorization,
      'x-owner-id': req.ownerContext.ownerId,
      'x-request-id': req.id,
    };

    const params = {
      restaurant_id: targetRestaurantId,
      branch_id: req.query.branch_id,
      status: req.query.status,
      search: req.query.search,
      period: req.query.period || req.query.range,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
    };

    const payoutData = await paymentOwnerClient.listSettlements(params, { headers });

    let restaurantMeta = null;
    try {
      restaurantMeta = await restaurantClient.getRestaurant(targetRestaurantId, {
        headers: { 'x-request-id': req.id },
      });
    } catch (error) {
      console.warn('[gateway → owner settlements] failed to fetch restaurant detail:', error.message);
    }

    const branchMap = new Map();
    const branchOptions = [];
    if (Array.isArray(restaurantMeta?.branches)) {
      restaurantMeta.branches.forEach((branch) => {
        if (!branch?.id) return;
        branchMap.set(branch.id, branch);
        branchOptions.push({
          id: branch.id,
          name: branch.name || branch.branch_name || 'Branch',
          location: formatBranchLocation(branch),
        });
      });
    }

    const settlements = (payoutData.settlements || []).map((settlement) => {
      const meta = branchMap.get(settlement.branchId);
      return {
        ...settlement,
        branchName: meta?.name || meta?.branch_name || settlement.branchName || 'Branch',
        branchLocation: formatBranchLocation(meta) || settlement.branchLocation || null,
      };
    });

    res.json({
      ...payoutData,
      settlements,
      restaurantId: targetRestaurantId,
      restaurantName: restaurantMeta?.name || payoutData.restaurantName || null,
      branches: branchOptions,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:settlementId/orders', attachOwnerContext, async (req, res, next) => {
  try {
    const ownerRestaurants = req.ownerContext?.restaurantIds || [];
    const targetRestaurantId = req.query.restaurant_id || ownerRestaurants[0];
    if (!targetRestaurantId) {
      return res.status(400).json({ error: 'restaurant_id is required' });
    }

    const headers = {
      Authorization: req.headers.authorization,
      'x-owner-id': req.ownerContext.ownerId,
      'x-request-id': req.id,
    };

    const data = await paymentOwnerClient.listSettlementOrders(
      req.params.settlementId,
      { restaurant_id: targetRestaurantId },
      { headers },
    );

    let restaurantMeta = null;
    let branchMeta = null;
    try {
      restaurantMeta = await restaurantClient.getRestaurant(targetRestaurantId, {
        headers: { 'x-request-id': req.id },
      });
      branchMeta = restaurantMeta?.branches?.find((branch) => branch?.id === data?.settlement?.branchId) || null;
    } catch (error) {
      console.warn('[gateway → owner settlement orders] failed to fetch restaurant detail:', error.message);
    }

    res.json({
      ...data,
      settlement: {
        ...data?.settlement,
        restaurantName: restaurantMeta?.name || data?.settlement?.restaurantName || null,
        branchName: branchMeta?.name || branchMeta?.branch_name || data?.settlement?.branchName || null,
        branchLocation: formatBranchLocation(branchMeta) || data?.settlement?.branchLocation || null,
      },
      orders: (data?.orders || []).map((order) => ({
        ...order,
        branchName: branchMeta?.name || branchMeta?.branch_name || order.branchName || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
