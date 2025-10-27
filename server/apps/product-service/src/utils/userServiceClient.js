const config = require('../config');
const { httpRequest } = require('./http');

async function createOwnerMainAccount({
  restaurantId,
  ownerUserId,
  loginEmail,
  displayName,
  phone,
  temporaryPassword,
}) {
  if (!restaurantId || !ownerUserId || !loginEmail || !temporaryPassword) {
    throw new Error('Missing required owner-main account payload');
  }

  const url = `${config.userService.baseUrl}/api/restaurants/${restaurantId}/accounts/owner-main`;
  return httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ownerUserId,
      loginEmail,
      displayName,
      phone,
      temporaryPassword,
    }),
    timeoutMs: config.userService.timeoutMs,
  });
}

async function createRestaurantMember({ restaurantId, payload }) {
  if (!restaurantId || !payload?.role || !payload?.loginEmail || !payload?.temporaryPassword) {
    throw new Error('Missing required member payload');
  }
  const url = `${config.userService.baseUrl}/api/restaurants/${restaurantId}/accounts/members`;
  return httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeoutMs: config.userService.timeoutMs,
  });
}

module.exports = {
  createOwnerMainAccount,
  createRestaurantMember,
};
