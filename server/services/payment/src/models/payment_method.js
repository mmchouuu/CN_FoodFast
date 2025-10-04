module.exports = (sequelize, DataTypes) => {
  const PaymentMethod = sequelize.define('PaymentMethod', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false }, // reference to User Service (just id)
    type: { type: DataTypes.STRING(50), allowNull: false }, // e.g. 'card', 'cod', 'bank_transfer'
    provider_token: DataTypes.TEXT, // encrypted token if stored
    last4: DataTypes.STRING(4),
    brand: DataTypes.STRING(50),
    exp_month: DataTypes.INTEGER,
    exp_year: DataTypes.INTEGER
  }, { tableName: 'payment_methods', timestamps: true, underscored: true });

  return PaymentMethod;
};
