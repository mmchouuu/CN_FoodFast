module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order_id: { type: DataTypes.UUID, allowNull: false }, // reference to Order Service
    payment_method_id: { type: DataTypes.UUID },
    amount: { type: DataTypes.DECIMAL(12,2), allowNull: false },
    currency: { type: DataTypes.STRING(10), defaultValue: 'VND' },
    status: { type: DataTypes.STRING(30), defaultValue: 'pending' }, // pending, succeeded, failed, refunded
    transaction_id: DataTypes.STRING(100),
    paid_at: DataTypes.DATE
  }, { tableName: 'payments', timestamps: true, underscored: true });

  return Payment;
};
