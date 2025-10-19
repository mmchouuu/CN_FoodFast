import api from './api';

const basePath = '/api/customer-addresses';

async function listAddresses() {
  const { data } = await api.get(basePath);
  return data;
}

async function createAddress(payload) {
  const { data } = await api.post(basePath, payload);
  return data;
}

async function updateAddress(addressId, payload) {
  const { data } = await api.put(`${basePath}/${addressId}`, payload);
  return data;
}

async function deleteAddress(addressId) {
  await api.delete(`${basePath}/${addressId}`);
}

async function setDefault(addressId) {
  const { data } = await api.post(`${basePath}/${addressId}/default`);
  return data;
}

const addressesService = {
  list: listAddresses,
  create: createAddress,
  update: updateAddress,
  remove: deleteAddress,
  setDefault,
};

export default addressesService;
