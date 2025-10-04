module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(30), defaultValue: 'pending' }, // pending, paid, cancelled
    total_amount: { type: DataTypes.DECIMAL(12,2), allowNull: false }
  }, { tableName: 'orders', timestamps: true, underscored: true });
  return Order;
};
