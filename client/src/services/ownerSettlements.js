import api from './api';

const basePath = '/owner/settlements';

export const fetchSettlements = async (params = {}) => {
  const { data } = await api.get(basePath, { params });
  return data;
};

export const fetchSettlementOrders = async (settlementId, params = {}) => {
  if (!settlementId) {
    throw new Error('settlementId is required');
  }
  const { data } = await api.get(`${basePath}/${settlementId}/orders`, { params });
  return data;
};

export default {
  fetchSettlements,
  fetchSettlementOrders,
};
