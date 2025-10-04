const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = require('./order')(sequelize, DataTypes);
const OrderItem = require('./order_item')(sequelize, DataTypes);

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

module.exports = { sequelize, Order, OrderItem };
