import api from './api';

const basePath = '/api/customers/addresses';

const withUserOverride = (config = {}, userId) => {
  if (!userId) return { ...config };
  return {
    ...config,
    params: { ...(config.params || {}), user_id: userId },
  };
};

const unwrapItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

async function listAddresses(options = {}) {
  const config = withUserOverride({}, options.userId);
  const { data } = await api.get(basePath, config);
  return unwrapItems(data);
}

async function createAddress(payload, options = {}) {
  const userId = options.userId ?? payload?.user_id;
  const config = withUserOverride({}, userId);
  const { data } = await api.post(basePath, payload, config);
  return data;
}

async function updateAddress(addressId, payload, options = {}) {
  const userId = options.userId ?? payload?.user_id;
  const config = withUserOverride({}, userId);
  const { data } = await api.put(`${basePath}/${addressId}`, payload, config);
  return data;
}

async function deleteAddress(addressId, options = {}) {
  const config = withUserOverride({}, options.userId);
  await api.delete(`${basePath}/${addressId}`, config);
  return true;
}

async function setDefault(addressId, options = {}) {
  const config = withUserOverride({}, options.userId);
  const { data } = await api.post(`${basePath}/${addressId}/default`, null, config);
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
