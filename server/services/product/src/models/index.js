const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Product = require('./product')(sequelize, DataTypes);
module.exports = { sequelize, Product };
