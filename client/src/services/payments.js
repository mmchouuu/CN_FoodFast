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

const paymentsService = {
  createPayment,
  get: getPayment,
};

export default paymentsService;

