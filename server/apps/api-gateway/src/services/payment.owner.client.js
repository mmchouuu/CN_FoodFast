const { createAxiosInstance } = require('../utils/httpClient');
const config = require('../config');

const ownerPaymentClient = createAxiosInstance({
  baseURL: `${config.paymentServiceUrl}/owner/payouts`,
  timeout: config.requestTimeout,
});

async function listSettlements(params = {}, opts = {}) {
  const res = await ownerPaymentClient.get('/', {
    params,
    headers: opts.headers,
  });
  return res.data;
}

async function listSettlementOrders(settlementId, params = {}, opts = {}) {
  const res = await ownerPaymentClient.get(`/${settlementId}/orders`, {
    params,
    headers: opts.headers,
  });
  return res.data;
}

module.exports = {
  listSettlements,
  listSettlementOrders,
};
