const adminClient = require('./admin.client');

const SORT_KEYS = new Set(['eta', 'battery', 'workload']);
const DEFAULT_SORT = 'eta';

function parseHubsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

const parseDataPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

async function fetchSummary(opts = {}) {
  const headers = opts.headers || {};
  const [ordersRes, droneSummary] = await Promise.all([
    adminClient.listPendingAssignmentOrders({}, { headers }),
    adminClient.getDeliveryDroneSummary({}, { headers }),
  ]);

  const pendingOrders = parseDataPayload(ordersRes);
  const totalPending =
    typeof ordersRes?.total === 'number' ? Number(ordersRes.total) : pendingOrders.length;
  const availableCount =
    typeof droneSummary?.available === 'number'
      ? droneSummary.available
      : droneSummary?.active || 0;
  const inFlightCount = droneSummary?.inFlight || 0;
  const avgEtaSeconds =
    typeof droneSummary?.avgEtaSeconds === 'number' ? droneSummary.avgEtaSeconds : 0;
  return {
    pendingOrders: totalPending,
    availableDrones: availableCount,
    inFlight: inFlightCount,
    avgEtaMinutes: avgEtaSeconds ? Math.round(avgEtaSeconds / 60) : 0,
  };
}

const mapOrderRow = (row = {}) => ({
  id: row.id,
  status: row.status,
  created_at: row.created_at,
  branch_id: row.branch_id,
  total_amount: row.total_amount,
  currency: row.currency,
  item_count: row.item_count || 0,
  shipping_address_snapshot: row.shipping_address_snapshot || null,
  metadata: row.metadata || {},
});

async function fetchHubAssignments({ hubId, sortBy = DEFAULT_SORT } = {}, opts = {}) {
  if (!hubId) {
    const err = new Error('hubId is required');
    err.status = 400;
    throw err;
  }

  const headers = opts.headers || {};
  const [hubPayload, ordersPayload, dronesPayload] = await Promise.all([
    adminClient.listDroneHubs({ headers }),
    adminClient.listAssignmentOrders({ hubId }, { headers }),
    adminClient.listDeliveryDrones({ hubId }, { headers }),
  ]);

  const hubs = parseHubsPayload(hubPayload);
  const hub = hubs.find((h) => h.id === hubId);
  if (!hub) {
    const err = new Error('Hub not found');
    err.status = 404;
    throw err;
  }

  const orders = parseDataPayload(ordersPayload).map(mapOrderRow);
  const orderIds = orders.map((order) => order.id).filter(Boolean);
  let deliveries = [];
  if (orderIds.length) {
    const deliveryRes = await adminClient.listDeliveriesByOrders(
      { orderIds: orderIds.join(',') },
      { headers },
    );
    deliveries = parseDataPayload(deliveryRes);
  }
  const deliveryMap = new Map(deliveries.map((delivery) => [delivery.order_id, delivery]));

  const formattedOrders = orders.map((order) => ({
    order,
    delivery: deliveryMap.get(order.id) || null,
  }));

  const drones = parseDataPayload(dronesPayload).map((drone) => ({
    id: drone.id,
    code: drone.code,
    status: drone.status,
    battery_level: drone.battery_level,
    flights_today: drone.flights_today || 0,
    workload: drone.active_deliveries || 0,
    last_known_position: drone.last_known_position || null,
  }));

  return {
    hub,
    sortBy: SORT_KEYS.has(sortBy) ? sortBy : DEFAULT_SORT,
    orders: formattedOrders,
    droneQueue: drones,
  };
}

async function fetchOrderHub(orderId, opts = {}) {
  if (!orderId) {
    const err = new Error('orderId is required');
    err.status = 400;
    throw err;
  }
  const headers = opts.headers || {};
  const order = await adminClient.getAdminOrder(orderId, { headers });
  if (!order) {
    return { orderId, hubId: null, hubName: null };
  }
  const hubId =
    order.assigned_hub_id || order.assignedHubId || order.metadata?.assigned_hub_id || null;
  if (!hubId) {
    return {
      orderId: order.id || orderId,
      hubId: null,
      hubName: null,
      assignedHubDistance: order.assigned_hub_distance_m || null,
    };
  }
  let hubName = null;
  try {
    const hubs = parseHubsPayload(await adminClient.listDroneHubs({ headers }));
    const hub = hubs.find((item) => item.id === hubId);
    hubName = hub?.name || null;
  } catch (error) {
    console.warn('[api-gateway] Failed to load hub metadata', error?.message || error);
  }
  return {
    orderId: order.id || orderId,
    hubId,
    hubName,
    assignedHubDistance: order.assigned_hub_distance_m || order.assignedHubDistanceM || null,
  };
}

async function assignOrderToDrone(orderId, payload = {}, opts = {}) {
  if (!payload?.deliveryId || !payload?.droneId) {
    const err = new Error('deliveryId and droneId are required');
    err.status = 400;
    throw err;
  }
  const headers = opts.headers || {};
  const result = await adminClient.assignDelivery(
    payload.deliveryId,
    {
      orderId,
      droneId: payload.droneId,
    },
    { headers },
  );
  return result;
}

async function reprocessOrder(orderId, opts = {}) {
  if (!orderId) {
    const err = new Error('orderId is required');
    err.status = 400;
    throw err;
  }
  return adminClient.reprocessOrderAssignment(orderId, opts);
}

module.exports = {
  fetchSummary,
  fetchHubAssignments,
  fetchOrderHub,
  assignOrderToDrone,
  reprocessOrder,
};
