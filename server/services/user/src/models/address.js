module.exports = (sequelize, DataTypes) => {
  const Address = sequelize.define('Address', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    street: { type: DataTypes.STRING(200), allowNull: false },
    ward: DataTypes.STRING(100),
    district: DataTypes.STRING(100),
    city: DataTypes.STRING(100),
    is_primary: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: 'user_addresses', timestamps: true, underscored: true });
  return Address;
};