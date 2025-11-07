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

export async function listMomoWallets({ userId } = {}) {
  const config = {};
  if (userId) {
    config.params = { user_id: userId };
  }
  const { data } = await api.get(`${basePath}/payment-methods/wallets`, config);
  if (Array.isArray(data?.wallets)) return data.wallets;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

export async function linkMomoWallet(payload = {}) {
  const config = {};
  if (payload?.user_id) {
    config.params = { user_id: payload.user_id };
  }
  const requestBody = {
    ...payload,
    type: payload.type || 'wallet',
    provider: payload.provider || 'momo',
  };
  const { data } = await api.post(`${basePath}/payment-methods`, requestBody, config);
  return data;
}

export async function listStripeCards({ userId } = {}) {
  const config = {};
  if (userId) {
    config.params = { user_id: userId };
  }
  const { data } = await api.get(`${basePath}/stripe/payment-methods`, config);
  return data;
}

export async function createStripeSetupIntent() {
  const { data } = await api.post(`${basePath}/stripe/setup-intent`);
  return data;
}

export async function confirmStripePaymentMethod(payload) {
  const { data } = await api.post(`${basePath}/stripe/confirm`, payload);
  return data;
}

const paymentsService = {
  createPayment,
  get: getPayment,
  listMomoWallets,
  linkMomoWallet,
  listStripeCards,
  createStripeSetupIntent,
  confirmStripePaymentMethod,
};

export default paymentsService;
