import api from './api';

const basePath = '/api/payments';

export async function createPayment(payload) {
  const { data } = await api.post(basePath, payload);
  return data;
}

export async function getPayment(paymentId) {
  const { data } = await api.get(`${basePath}/${paymentId}`);
  return data;
}

export async function listBankAccounts({ userId } = {}) {
  const config = {};
  if (userId) {
    config.params = { user_id: userId };
  }
  const { data } = await api.get(`${basePath}/payment-methods/bank-accounts`, config);
  return data;
}

export async function linkBankAccount(payload) {
  const config = {};
  if (payload?.user_id) {
    config.params = { user_id: payload.user_id };
  }
  const { data } = await api.post(`${basePath}/payment-methods/bank-accounts`, payload, config);
  return data;
}

const paymentsService = {
  createPayment,
  get: getPayment,
  listBankAccounts,
  linkBankAccount,
};

export default paymentsService;

