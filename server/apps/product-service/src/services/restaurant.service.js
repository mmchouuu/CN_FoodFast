const { withTransaction } = require('../db');
const restaurantRepository = require('../repositories/restaurant.repository');
const taxRepository = require('../repositories/tax.repository');
const { generatePassword } = require('../utils/password');
const { publishSocketEvent } = require('../utils/rabbitmq');
const {
  createOwnerMainAccount,
  createRestaurantMember,
} = require('../utils/userServiceClient');

function assert(value, message) {
  if (!value) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
}

function normaliseString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const DEFAULT_TAX_CONFIG = {
  templateCode: 'VAT7_DEFAULT',
  templateName: 'VAT 7%',
  templateDescription: 'Default VAT 7% applied automatically to new restaurants and branches',
  ratePercent: 7,
  priority: 10,
};

async function ensureDefaultTaxTemplate(client) {
  return taxRepository.createTaxTemplate(
    {
      code: DEFAULT_TAX_CONFIG.templateCode,
      name: DEFAULT_TAX_CONFIG.templateName,
      description: DEFAULT_TAX_CONFIG.templateDescription,
    },
    client,
  );
}

async function ensureRestaurantDefaultTax(restaurantId, client) {
  const template = await ensureDefaultTaxTemplate(client);
  const assignment = await taxRepository.assignTaxToRestaurant(
    {
      restaurantId,
      taxTemplateId: template.id,
      ratePercent: DEFAULT_TAX_CONFIG.ratePercent,
      isDefault: true,
      priority: DEFAULT_TAX_CONFIG.priority,
      isActive: true,
    },
    client,
  );
  return { template, assignment };
}

async function ensureBranchDefaultTax(restaurantId, branchId, client) {
  const { template, assignment: restaurantAssignment } = await ensureRestaurantDefaultTax(
    restaurantId,
    client,
  );
  const branchAssignment = await taxRepository.assignTaxToBranch(
    {
      branchId,
      taxTemplateId: template.id,
      ratePercent: DEFAULT_TAX_CONFIG.ratePercent,
      isDefault: true,
      priority: DEFAULT_TAX_CONFIG.priority,
      isActive: true,
    },
    client,
  );
  return { template, restaurantAssignment, branchAssignment };
}

async function createRestaurant(payload = {}) {
  const ownerUserId = payload.ownerUserId || payload.owner_id || payload.ownerId;
  assert(ownerUserId, 'ownerUserId is required');
  assert(payload.name, 'Restaurant name is required');

  const ownerMainAccount = { ...(payload.ownerMainAccount || payload.ownerMain || {}) };
  if (!ownerMainAccount.loginEmail) {
    ownerMainAccount.loginEmail =
      payload.ownerLoginEmail ||
      payload.ownerEmail ||
      payload.loginEmail ||
      payload.email ||
      null;
  }
  if (typeof ownerMainAccount.loginEmail === 'string') {
    ownerMainAccount.loginEmail = ownerMainAccount.loginEmail.trim().toLowerCase();
  }
  assert(ownerMainAccount.loginEmail, 'ownerMainAccount.loginEmail is required');

  const { restaurant, defaultTax } = await withTransaction(async (client) => {
    const restaurant = await restaurantRepository.createRestaurant({
      ownerUserId,
      name: payload.name,
      description: normaliseString(payload.description),
      about: normaliseString(payload.about),
      cuisine: normaliseString(payload.cuisine),
      phone: normaliseString(payload.phone),
      email: normaliseString(payload.email),
      logo: Array.isArray(payload.logo) ? payload.logo : [],
      images: Array.isArray(payload.images) ? payload.images : [],
      isActive: payload.isActive !== false,
    }, client);

    const defaultTax = await ensureRestaurantDefaultTax(restaurant.id, client);

    return { restaurant, defaultTax };
  });

  const tempPassword = ownerMainAccount.temporaryPassword || generatePassword(12);

  let ownerAccountResponse = null;
  try {
    ownerAccountResponse = await createOwnerMainAccount({
      restaurantId: restaurant.id,
      ownerUserId,
      loginEmail: ownerMainAccount.loginEmail,
      displayName: ownerMainAccount.displayName || restaurant.name,
      phone: ownerMainAccount.phone || payload.phone || null,
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[product-service] Failed to create owner main account:', error.message);
  }

  publishSocketEvent(
    'restaurant.created',
    {
      restaurant,
      branches: [],
      ownerUserId,
      defaultTax,
    },
    [
      'admin:restaurants',
      'catalog:restaurants',
      `restaurant-owner:${ownerUserId}`,
      `restaurant:${restaurant.id}`,
    ],
  );

  return {
    restaurant,
    branches: [],
    defaultTax,
    ownerMainAccount: ownerAccountResponse || {
      loginEmail: ownerMainAccount.loginEmail,
      temporaryPassword: tempPassword,
    },
  };
}

async function createBranch(restaurantId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(payload.street, 'Branch street is required');

  const { branch, defaultTax } = await withTransaction(async (client) => {
    const branchPhone = normaliseString(
      payload.branchPhone !== undefined ? payload.branchPhone : payload.phone,
    );
    const branchEmail = normaliseString(
      payload.branchEmail !== undefined ? payload.branchEmail : payload.email,
    );

    const created = await restaurantRepository.createBranch({
      restaurantId,
      branchNumber: payload.branchNumber,
      name: payload.name || null,
      branchPhone,
      branchEmail,
      images: Array.isArray(payload.images) ? payload.images : [],
      street: payload.street,
      ward: normaliseString(payload.ward),
      district: normaliseString(payload.district),
      city: normaliseString(payload.city),
      latitude: payload.latitude || null,
      longitude: payload.longitude || null,
      isPrimary: payload.isPrimary === true,
      isOpen: payload.isOpen === true,
    }, client);

    if (Array.isArray(payload.openingHours) && payload.openingHours.length) {
      await restaurantRepository.setOpeningHours(created.id, payload.openingHours, client);
    }

    if (Array.isArray(payload.specialHours) && payload.specialHours.length) {
      await restaurantRepository.setSpecialHours(created.id, payload.specialHours, client);
    }

    const defaultTax = await ensureBranchDefaultTax(restaurantId, created.id, client);

    return { branch: created, defaultTax };
  });

  publishSocketEvent(
    'restaurant.branch.created',
    {
      restaurantId,
      branch,
      defaultTax,
    },
    [`restaurant:${restaurantId}`, `restaurant-branch:${branch.id}`],
  );

  return {
    ...branch,
    defaultTax,
  };
}

async function upsertBranchSchedules(restaurantId, branchId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(branchId, 'branchId is required');

  await withTransaction(async (client) => {
    if (Array.isArray(payload.openingHours)) {
      await restaurantRepository.setOpeningHours(branchId, payload.openingHours, client);
    }
    if (Array.isArray(payload.specialHours)) {
      await restaurantRepository.setSpecialHours(branchId, payload.specialHours, client);
    }
  });

  publishSocketEvent(
    'restaurant.branch.schedules.updated',
    {
      restaurantId,
      branchId,
      openingHours: Array.isArray(payload.openingHours) ? payload.openingHours : [],
      specialHours: Array.isArray(payload.specialHours) ? payload.specialHours : [],
    },
    [`restaurant:${restaurantId}`, `restaurant-branch:${branchId}`],
  );

  return { message: 'Branch schedules updated' };
}

async function inviteRestaurantMember(restaurantId, payload = {}) {
  assert(restaurantId, 'restaurantId is required');
  assert(payload.role, 'role is required');
  assert(payload.loginEmail, 'loginEmail is required');

  const temporaryPassword = payload.temporaryPassword || generatePassword(10);
  const body = {
    restaurantId,
    payload: {
      branchId: payload.branchId || null,
      role: payload.role,
      loginEmail: payload.loginEmail,
      displayName: payload.displayName || null,
      phone: payload.phone || null,
      permissions: payload.permissions || {},
      temporaryPassword,
    },
  };

  const response = await createRestaurantMember(body);

  publishSocketEvent(
    'restaurant.member.invited',
    {
      restaurantId,
      role: payload.role,
      account: response.account || null,
      membership: response.membership || null,
    },
    [`restaurant:${restaurantId}`],
  );

  return {
    response,
    temporaryPassword,
  };
}

function mapOpeningHourRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    dayOfWeek: row.day_of_week,
    openTime: row.open_time,
    closeTime: row.close_time,
    isClosed: row.is_closed,
    overnight: row.overnight,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSpecialHourRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.on_date,
    openTime: row.open_time,
    closeTime: row.close_time,
    isClosed: row.is_closed,
    overnight: row.overnight,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function hydrateBranch(branch, client) {
  if (!branch) return null;
  const [openingRows, specialRows] = await Promise.all([
    restaurantRepository.getBranchOpeningHours(branch.id, client),
    restaurantRepository.getBranchSpecialHours(branch.id, client),
  ]);
  return {
    ...branch,
    openingHours: openingRows.map(mapOpeningHourRow).filter(Boolean),
    specialHours: specialRows.map(mapSpecialHourRow).filter(Boolean),
  };
}

async function buildRestaurantPayload(restaurant, client) {
  if (!restaurant) return null;
  const branchRows = await restaurantRepository.listBranches(restaurant.id, client);
  const branches = await Promise.all(branchRows.map((branch) => hydrateBranch(branch, client)));
  return {
    ...restaurant,
    branches,
  };
}

async function getRestaurantDetailsByOwner(ownerUserId) {
  if (!ownerUserId) return null;
  const restaurant = await restaurantRepository.findRestaurantByOwner(ownerUserId);
  if (!restaurant) return null;
  return buildRestaurantPayload(restaurant);
}

async function listRestaurantsByOwner(ownerUserId) {
  if (!ownerUserId) return [];
  const list = await restaurantRepository.listRestaurantsByOwner(ownerUserId);
  return Promise.all(list.map((restaurant) => buildRestaurantPayload(restaurant)));
}

async function getRestaurantById(restaurantId) {
  if (!restaurantId) return null;
  const restaurant = await restaurantRepository.findRestaurantById(restaurantId);
  if (!restaurant) return null;
  return buildRestaurantPayload(restaurant);
}

async function updateRestaurantDetails(restaurantId, payload = {}) {
  if (!restaurantId) {
    throw new Error('restaurantId is required');
  }
  const fields = {
    name: payload.name,
    description: payload.description,
    about: payload.about,
    cuisine: payload.cuisine,
    phone: payload.phone,
    email: payload.email,
    logo: payload.logo,
    images: payload.images,
    isActive: payload.isActive,
  };
  const updated = await restaurantRepository.updateRestaurant(restaurantId, fields);
  if (!updated) return null;
  return buildRestaurantPayload(updated);
}

async function listRestaurantBranches(restaurantId) {
  if (!restaurantId) return [];
  const rows = await restaurantRepository.listBranches(restaurantId);
  return Promise.all(rows.map((branch) => hydrateBranch(branch)));
}

async function updateBranchDetails(restaurantId, branchId, payload = {}) {
  if (!restaurantId || !branchId) {
    throw new Error('restaurantId and branchId are required');
  }

  const fields = {
    name: payload.name,
    branchNumber: payload.branchNumber,
    branchPhone: payload.branchPhone || payload.phone,
    branchEmail: payload.branchEmail || payload.email,
    images: payload.images,
    street: payload.street,
    ward: payload.ward,
    district: payload.district,
    city: payload.city,
    latitude: payload.latitude,
    longitude: payload.longitude,
    isPrimary: payload.isPrimary,
    isOpen: payload.isOpen,
  };

  const updatedBranch = await withTransaction(async (client) => {
    const branch = await restaurantRepository.updateBranch(restaurantId, branchId, fields, client);
    if (!branch) {
      return null;
    }
    if (Array.isArray(payload.openingHours)) {
      await restaurantRepository.setOpeningHours(branch.id, payload.openingHours, client);
    }
    if (Array.isArray(payload.specialHours)) {
      await restaurantRepository.setSpecialHours(branch.id, payload.specialHours, client);
    }
    return branch;
  });

  if (!updatedBranch) return null;
  return hydrateBranch(updatedBranch);
}

async function deleteBranch(restaurantId, branchId) {
  if (!restaurantId || !branchId) {
    throw new Error('restaurantId and branchId are required');
  }
  return restaurantRepository.deleteBranch(restaurantId, branchId);
}

module.exports = {
  createRestaurant,
  createBranch,
  upsertBranchSchedules,
  inviteRestaurantMember,
  getRestaurantById,
  getRestaurantDetailsByOwner,
  listRestaurantsByOwner,
  updateRestaurantDetails,
  listRestaurantBranches,
  updateBranchDetails,
  deleteBranch,
};
