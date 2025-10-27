const userRepository = require('../repositories/user.repository');
const addressRepository = require('../repositories/address.repository');
const restaurantService = require('../services/restaurant.service');

async function listCustomers(options = {}) {
  const items = await userRepository.listCustomers(options);
  return { items };
}

async function setCustomerActiveStatus(userId, isActive) {
  await userRepository.setCustomerActiveStatus(userId, isActive);
  return { message: 'Status updated' };
}

async function getCustomerDetails(userId) {
  const [addresses, profile] = await Promise.all([
    addressRepository.listByUserId(userId),
    userRepository.getCustomerProfile(userId),
  ]);
  return { addresses, profile };
}

async function listOwnerApplicants(options = {}) {
  const items = await userRepository.listOwnerProfiles(options);
  return { items };
}

async function approveOwner(ownerId, adminUserId) {
  return restaurantService.adminApproveOwner({ ownerId, adminUserId });
}

async function rejectOwner(ownerId, adminUserId, reason) {
  return restaurantService.adminRejectOwner({ ownerId, adminUserId, reason });
}

module.exports = {
  listCustomers,
  setCustomerActiveStatus,
  getCustomerDetails,
  listOwnerApplicants,
  approveOwner,
  rejectOwner,
};
