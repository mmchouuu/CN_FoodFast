const adminClient = require('../services/admin.client');
const restaurantClient = require('../services/restaurant.client');
const assignmentService = require('../services/assignment.service');

function withRequestHeaders(req) {
  const headers = { 'x-request-id': req.id };
  if (req.headers?.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  return { headers };
}

const formatBranchLocation = (branch) => {
  if (!branch) return null;
  const city = branch.city || branch.branch_city || null;
  const district = branch.district || branch.branch_district || null;
  const street = branch.street || branch.branch_street || null;
  const parts = [city, district, street].filter((value) => typeof value === 'string' && value.trim().length);
  if (!parts.length) return null;
  return parts.join(' • ');
};

async function login(req, res, next) {
  try {
    const result = await adminClient.login(req.body || {}, withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listCustomers(req, res, next) {
  try {
    const result = await adminClient.listCustomers(withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function customerDetails(req, res, next) {
  try {
    const result = await adminClient.customerDetails(req.params.id, withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function updateCustomerStatus(req, res, next) {
  try {
    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive boolean is required' });
    }
    const result = await adminClient.updateCustomerStatus(
      req.params.id,
      { isActive },
      withRequestHeaders(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listOwners(req, res, next) {
  try {
    const result = await adminClient.listOwners(withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function approveOwner(req, res, next) {
  try {
    const result = await adminClient.approveOwner(
      req.params.id,
      { adminUserId: req.user?.userId ?? null },
      withRequestHeaders(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function rejectOwner(req, res, next) {
  try {
    const result = await adminClient.rejectOwner(
      req.params.id,
      {
        adminUserId: req.user?.userId ?? null,
        reason: req.body?.reason || null,
      },
      withRequestHeaders(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createTaxTemplate(req, res, next) {
  try {
    const result = await adminClient.createTaxTemplate(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function assignTax(req, res, next) {
  try {
    const result = await adminClient.assignTax(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function createCalendar(req, res, next) {
  try {
    const result = await adminClient.createCalendar(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function createGlobalPromotion(req, res, next) {
  try {
    const result = await adminClient.createGlobalPromotion(req.body || {}, withRequestHeaders(req));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function listPayoutRestaurants(req, res, next) {
  try {
    const headers = withRequestHeaders(req);
    const payload = await adminClient.listPayoutRestaurants(req.query || {}, headers);
    const restaurants = Array.isArray(payload.restaurants) ? payload.restaurants : [];
    const ids = [...new Set(restaurants.map((item) => item.restaurantId).filter(Boolean))];

    let metadataMap = new Map();
    if (ids.length) {
      const metadata = await Promise.all(
        ids.map((id) =>
          restaurantClient
            .getRestaurant(id, headers)
            .catch((error) => {
              console.warn('[api-gateway] failed to fetch restaurant metadata', id, error?.message || error);
              return null;
            }),
        ),
      );
      metadataMap = new Map(metadata.filter(Boolean).map((restaurant) => [restaurant.id, restaurant]));
    }

    const enriched = restaurants.map((item) => {
      const meta = metadataMap.get(item.restaurantId);
      return {
        ...item,
        restaurantName: meta?.name || item.restaurantName || 'Restaurant',
        branchCount: meta?.branches?.length ?? item.branchCount ?? 0,
      };
    });

    res.json({ ...payload, restaurants: enriched });
  } catch (error) {
    next(error);
  }
}

async function listPayoutBranches(req, res, next) {
  try {
    const headers = withRequestHeaders(req);
    const payload = await adminClient.listPayoutBranches(
      req.params.restaurantId,
      req.query || {},
      headers,
    );

    let restaurantMeta = null;
    try {
      restaurantMeta = await restaurantClient.getRestaurant(req.params.restaurantId, headers);
    } catch (metaError) {
      console.warn('[api-gateway] failed to load restaurant for branches', metaError?.message || metaError);
    }

    const branchMap = new Map();
    if (restaurantMeta?.branches) {
      restaurantMeta.branches.forEach((branch) => {
        if (branch?.id) {
          branchMap.set(branch.id, branch);
        }
      });
    }

    const enrichedBranches = (payload.branches || []).map((branch) => {
      const meta = branchMap.get(branch.branchId) || null;
      return {
        ...branch,
        branchName: meta?.name || meta?.branch_name || branch.branchName || 'Branch',
        location: formatBranchLocation(meta),
      };
    });

    res.json({
      ...payload,
      restaurantName: restaurantMeta?.name || payload.restaurantName || null,
      branches: enrichedBranches,
    });
  } catch (error) {
    next(error);
  }
}

async function listPayoutSettlementOrders(req, res, next) {
  try {
    const headers = withRequestHeaders(req);
    const payload = await adminClient.listSettlementOrders(req.params.settlementId, headers);

    let restaurantMeta = null;
    let branchMeta = null;
    if (payload?.settlement?.restaurantId) {
      try {
        restaurantMeta = await restaurantClient.getRestaurant(payload.settlement.restaurantId, headers);
        if (restaurantMeta?.branches?.length) {
          branchMeta = restaurantMeta.branches.find(
            (branch) => branch && branch.id === payload.settlement.branchId,
          );
        }
      } catch (metaError) {
        console.warn('[api-gateway] failed to load restaurant for orders', metaError?.message || metaError);
      }
    }

    const enrichedSettlement = {
      ...payload.settlement,
      restaurantName: restaurantMeta?.name || payload.settlement?.restaurantName || null,
      branchName: branchMeta?.name || branchMeta?.branch_name || payload.settlement?.branchName || null,
      branchLocation: formatBranchLocation(branchMeta),
    };

    res.json({ ...payload, settlement: enrichedSettlement });
  } catch (error) {
    next(error);
  }
}

async function getDroneSystemSummary(req, res, next) {
  try {
    const summary = await adminClient.getDroneSystemSummary(withRequestHeaders(req));
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

async function listDroneHubs(req, res, next) {
  try {
    const hubs = await adminClient.listDroneHubs(withRequestHeaders(req));
    res.json(hubs);
  } catch (error) {
    next(error);
  }
}

async function getDroneHubOverview(req, res, next) {
  try {
    const overview = await adminClient.getDroneHubOverview(
      req.params.hubId,
      withRequestHeaders(req),
    );
    res.json(overview);
  } catch (error) {
    next(error);
  }
}

async function listAdminDrones(req, res, next) {
  try {
    const result = await adminClient.listDeliveryDrones(req.query || {}, withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createAdminDrone(req, res, next) {
  try {
    const payload = req.body || {};
    const data = await adminClient.createDeliveryDrone(payload, withRequestHeaders(req));
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

async function updateAdminDrone(req, res, next) {
  try {
    const payload = req.body || {};
    const data = await adminClient.updateDeliveryDrone(req.params.id, payload, withRequestHeaders(req));
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function deleteAdminDrone(req, res, next) {
  try {
    const data = await adminClient.deleteDeliveryDrone(req.params.id, withRequestHeaders(req));
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getAdminDroneLogs(req, res, next) {
  try {
    const result = await adminClient.getDeliveryDroneLogs(req.params.id, withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function listAdminDeliveries(req, res, next) {
  try {
    const headers = withRequestHeaders(req);
    const { orderIds, order_ids: legacyOrderIds, ...restQuery } = req.query || {};
    const rawOrderIds = orderIds ?? legacyOrderIds ?? null;

    if (rawOrderIds) {
      const orderParam =
        Array.isArray(rawOrderIds) ? rawOrderIds.join(',') : String(rawOrderIds);
      const result = await adminClient.listDeliveriesByOrders(
        { orderIds: orderParam },
        headers,
      );
      return res.json(result);
    }

    const result = await adminClient.listDeliveries(restQuery, headers);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getAssignmentSummary(req, res, next) {
  try {
    const summary = await assignmentService.fetchSummary(withRequestHeaders(req));
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

async function getHubAssignments(req, res, next) {
  try {
    const { hubId } = req.params;
    const { sort } = req.query || {};
    const payload = await assignmentService.fetchHubAssignments(
      { hubId, sortBy: sort },
      withRequestHeaders(req),
    );
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function getOrderHubDetails(req, res, next) {
  try {
    const { orderId } = req.params;
    const payload = await assignmentService.fetchOrderHub(orderId, withRequestHeaders(req));
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function assignOrderToDrone(req, res, next) {
  try {
    const { orderId } = req.params;
    const payload = req.body || {};
    if (!payload.deliveryId || !payload.droneId) {
      return res.status(400).json({ error: 'deliveryId and droneId are required' });
    }
    const result = await assignmentService.assignOrderToDrone(
      orderId,
      {
        deliveryId: payload.deliveryId,
        droneId: payload.droneId,
      },
      withRequestHeaders(req),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function reprocessOrderAssignment(req, res, next) {
  try {
    const { orderId } = req.params;
    const result = await assignmentService.reprocessOrder(orderId, withRequestHeaders(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
}


module.exports = {
  listCustomers,
  customerDetails,
  updateCustomerStatus,
  listOwners,
  approveOwner,
  rejectOwner,
  createTaxTemplate,
  assignTax,
  createCalendar,
  createGlobalPromotion,
  login,
  listPayoutRestaurants,
  listPayoutBranches,
  listPayoutSettlementOrders,
  getDroneSystemSummary,
  listDroneHubs,
  getDroneHubOverview,
  listAdminDrones,
  createAdminDrone,
  updateAdminDrone,
  deleteAdminDrone,
  getAdminDroneLogs,
  listAdminDeliveries,
  getAssignmentSummary,
  getHubAssignments,
  getOrderHubDetails,
  assignOrderToDrone,
  reprocessOrderAssignment
};
