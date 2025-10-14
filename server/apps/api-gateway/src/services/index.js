// api-gateway/src/services/index.js
const customerClient = require('./customer.client');
const restaurantClient = require('./restaurant.client');
const adminClient = require('./admin.client');

module.exports = {
  customerClient,
  restaurantClient,
  adminClient,
};
