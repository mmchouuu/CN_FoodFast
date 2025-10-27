import api from './api';

const basePath = '/api/admin';

const unwrapItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normaliseOwnerStatus = (status, emailVerified) => {
  const rawStatus = status || 'pending';
  if (rawStatus === 'approved' && emailVerified) return 'active';
  if (rawStatus === 'approved') return 'approve';
  if (rawStatus === 'rejected') return 'locked';
  return rawStatus;
};

const adaptCustomer = (item) => ({
  id: item.id,
  email: item.email || null,
  first_name: item.first_name ?? item.firstName ?? null,
  last_name: item.last_name ?? item.lastName ?? null,
  phone: item.phone ?? null,
  is_active: item.is_active ?? item.isActive ?? false,
  is_verified: item.email_verified ?? item.is_verified ?? false,
  tier: item.tier ?? null,
  loyalty_points: item.loyalty_points ?? null,
  profile_updated_at: item.profile_updated_at || null,
});

const adaptOwner = (item) => {
  const restaurantStatus = normaliseOwnerStatus(item.status, item.email_verified);
  return {
    id: item.id,
    email: item.email || null,
    first_name: item.first_name || null,
    last_name: item.last_name || null,
    manager_name: item.manager_name || null,
    restaurant_name: item.legal_name || null,
    company_address: item.company_address || null,
    tax_code: item.tax_code || null,
    phone: item.phone || null,
    restaurant_status: restaurantStatus,
    is_active: restaurantStatus === 'active',
    email_verified: item.email_verified ?? null,
    approved_at: item.approved_at || null,
    approved_by: item.approved_by || null,
    created_at: item.created_at || null,
  };
};

const ownerActionMap = {
  approve: { endpoint: 'approve' },
  active: { endpoint: 'approve' },
  lock: { endpoint: 'reject', reason: 'Locked by admin' },
  warning: { endpoint: 'reject', reason: 'Warning issued by admin' },
  reject: { endpoint: 'reject' },
};

const moderateOwner = async (ownerId, action) => {
  const entry = ownerActionMap[action];
  if (!entry) {
    throw new Error(`Unsupported owner action: ${action}`);
  }
  if (entry.endpoint === 'approve') {
    const { data } = await api.post(`${basePath}/owners/${ownerId}/approve`, {});
    return data;
  }
  const { data } = await api.post(
    `${basePath}/owners/${ownerId}/reject`,
    entry.reason ? { reason: entry.reason } : {},
  );
  return data;
};

const fetchOwners = async () => {
  const { data } = await api.get(`${basePath}/owners`);
  const items = unwrapItems(data);
  return items.map(adaptOwner);
};

const adminService = {
  async getCustomers() {
    const { data } = await api.get(`${basePath}/customers`);
    const items = unwrapItems(data);
    return items.map(adaptCustomer);
  },

  async getRestaurants() {
    return fetchOwners();
  },

  async getUserDetails(id) {
    const owners = await fetchOwners();
    const owner = owners.find((item) => String(item.id) === String(id));
    if (!owner) {
      return null;
    }
    const addresses = owner.company_address
      ? [
          {
            id: `${owner.id}-company`,
            street: owner.company_address,
            ward: null,
            district: null,
            city: null,
            is_primary: true,
          },
        ]
      : [];
    return {
      user: { ...owner, role: 'owner' },
      addresses,
    };
  },

  async updateUserActiveStatus(id, statusPayload) {
    if (typeof statusPayload === 'string') {
      return moderateOwner(id, statusPayload);
    }

    let isActive = null;
    if (typeof statusPayload === 'boolean') {
      isActive = statusPayload;
    } else if (statusPayload && typeof statusPayload === 'object') {
      if (Object.prototype.hasOwnProperty.call(statusPayload, 'isActive')) {
        isActive = Boolean(statusPayload.isActive);
      } else if (Object.prototype.hasOwnProperty.call(statusPayload, 'is_active')) {
        isActive = Boolean(statusPayload.is_active);
      }
    }

    if (isActive === null) {
      throw new Error('Invalid customer status payload');
    }

    const { data } = await api.patch(`${basePath}/customers/${id}/status`, { isActive });
    return data;
  },

  async approveRestaurant(id) {
    return moderateOwner(id, 'approve');
  },
};

export default adminService;
