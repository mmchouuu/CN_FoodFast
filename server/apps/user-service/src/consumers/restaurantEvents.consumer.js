const restaurantService = require('../services/restaurant.service');
const { subscribeRestaurantEvents } = require('../utils/rabbitmq');

const generateFallbackPassword = (length = 12) => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
  let password = '';
  while (password.length < length) {
    const random = Math.floor(Math.random() * charset.length);
    password += charset[random];
  }
  return password;
};

const toStringOrNull = (value) => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

async function handleRestaurantCreatedEvent(payload = {}) {
  const restaurantId = payload.restaurant_id || payload.restaurantId;
  const ownerUserId = payload.owner_user_id || payload.ownerUserId;
  const restaurantName = payload.restaurant_name || payload.restaurantName || null;
  const account = payload.owner_main_account || payload.ownerMainAccount || {};

  const loginEmail = toStringOrNull(account.login_email || account.loginEmail);
  if (!restaurantId || !ownerUserId || !loginEmail) {
    console.warn('[user-service] Missing data in restaurant.created payload', payload);
    return;
  }

  const request = {
    restaurantId,
    ownerUserId,
    loginEmail,
    displayName:
      toStringOrNull(account.display_name || account.displayName) ||
      restaurantName ||
      loginEmail,
    phone: toStringOrNull(account.phone),
    temporaryPassword:
      toStringOrNull(account.temporary_password || account.temporaryPassword) ||
      generateFallbackPassword(),
  };

  await restaurantService.createOwnerMainAccount(request);
  console.log('[user-service] Owner main account synced for restaurant', restaurantId);
}

async function startRestaurantEventConsumer() {
  await subscribeRestaurantEvents(async (message) => {
    const eventName = (message?.event || '').toLowerCase();
    if (eventName === 'restaurant.created' || eventName === 'restaurant_created') {
      await handleRestaurantCreatedEvent(message.payload || {});
      return;
    }
    console.log('[user-service] Ignored restaurant event', message?.event);
  });
  console.log('[user-service] Subscribed to restaurant events queue');
}

module.exports = startRestaurantEventConsumer;
