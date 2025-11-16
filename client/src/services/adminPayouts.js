import api from './api';

const basePath = '/api/admin/payouts';

const normalizeStatus = (status) => {
  if (!status && status !== 0) return 'pending';
  const raw = status.toString().toLowerCase();
  if (raw === 'all paid' || raw === 'all_paid') {
    return 'paid';
  }
  return raw;
};

const adaptRestaurant = (item = {}) => ({
  id: item.restaurantId,
  name: item.restaurantName || 'Restaurant',
  branchCount: item.branchCount ?? 0,
  totalOnlineSales: item.totalOnlineSales ?? item.totalOnlineSalesPeriod ?? 0,
  totalPendingPayout: item.totalPendingPayout ?? 0,
  totalNetAmount: item.totalNetAmount ?? 0,
  lastPayoutDate: item.lastPayoutDate || null,
  overallStatus: normalizeStatus(item.overallStatus || item.status || 'pending'),
  pendingBranches: item.pendingBranches ?? 0,
});

const adaptBranch = (item = {}) => ({
  id: item.branchId,
  name: item.branchName || 'Branch',
  location: item.location || null,
  settlementId: item.settlementId,
  onlineOrders: item.onlineOrders ?? 0,
  totalSales: item.totalSales ?? 0,
  pendingPayout: item.pendingPayout ?? 0,
  netAmount: item.netAmount ?? 0,
  status: normalizeStatus(item.status || item.settlementStatus || 'pending'),
  settlementStatus: item.settlementStatus || null,
  payoutStatus: item.payoutStatus || null,
  periodStart: item.periodStart || null,
  periodEnd: item.periodEnd || null,
});

const adaptOrder = (item = {}) => {
  const paymentMethod = item.paymentMethod || {};
  const keySource = paymentMethod.key || paymentMethod.brand || paymentMethod.provider;
  return {
    id: item.orderId,
    totalSales: item.totalSales ?? 0,
    vat: item.vat ?? 0,
    deliveryFee: item.deliveryFee ?? 0,
    netPayout: item.netPayout ?? 0,
    orderDate: item.orderDate || null,
    paymentMethod: paymentMethod.label || paymentMethod.provider || 'online',
    paymentKey: normalizeStatus(keySource || paymentMethod.type),
    status: normalizeStatus(item.status || 'pending'),
    currency: item.currency || 'VND',
  };
};

const adaptParams = (params = {}) => ({
  period: params.period,
  status: params.status,
  start_date: params.startDate,
  end_date: params.endDate,
});

export async function fetchPayoutOverview(params = {}) {
  const query = adaptParams(params);
  const { data } = await api.get(basePath, { params: query });
  const restaurants = Array.isArray(data?.restaurants) ? data.restaurants.map(adaptRestaurant) : [];
  return {
    period: data?.period || null,
    summary: data?.summary || {
      totalOnlineSales: 0,
      pendingPayout: 0,
      restaurantsPending: 0,
      pendingBranches: 0,
    },
    restaurants,
  };
}

export async function fetchRestaurantBranches(restaurantId, params = {}) {
  const query = adaptParams(params);
  const { data } = await api.get(`${basePath}/restaurants/${restaurantId}/branches`, {
    params: query,
  });
  const branches = Array.isArray(data?.branches) ? data.branches.map(adaptBranch) : [];
  return {
    period: data?.period || null,
    restaurantId: data?.restaurantId || restaurantId,
    restaurantName: data?.restaurantName || null,
    branches,
  };
}

export async function fetchSettlementOrders(settlementId) {
  const { data } = await api.get(`${basePath}/settlements/${settlementId}/orders`);
  const orders = Array.isArray(data?.orders) ? data.orders.map(adaptOrder) : [];
  return {
    settlement: data?.settlement || null,
    totals: data?.totals || { totalSales: 0, vat: 0, netPayout: 0, deliveryFee: 0, count: 0 },
    orders,
  };
}

export default {
  fetchPayoutOverview,
  fetchRestaurantBranches,
  fetchSettlementOrders,
};
