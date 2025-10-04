const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = require('./user')(sequelize, DataTypes);
const Address = require('./address')(sequelize, DataTypes);

User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { sequelize, User, Address };