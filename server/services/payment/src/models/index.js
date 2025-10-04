const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = require('./payment')(sequelize, DataTypes);
const PaymentMethod = require('./payment_method')(sequelize, DataTypes);

PaymentMethod.hasMany(Payment, { foreignKey: 'payment_method_id', as: 'payments' });
Payment.belongsTo(PaymentMethod, { foreignKey: 'payment_method_id', as: 'method' });

module.exports = { sequelize, Payment, PaymentMethod };
