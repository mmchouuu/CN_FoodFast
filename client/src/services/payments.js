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

export async function listBankAccounts() {
  const { data } = await api.get(`${basePath}/payment-methods/bank-accounts`);
  return data;
}

export async function linkBankAccount(payload) {
  const { data } = await api.post(`${basePath}/payment-methods/bank-accounts`, payload);
  return data;
}

const paymentsService = {
  createPayment,
  get: getPayment,
  listBankAccounts,
  linkBankAccount,
};

export default paymentsService;

