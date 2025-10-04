module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    first_name: DataTypes.STRING(50),
    last_name: DataTypes.STRING(50),
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    phone: DataTypes.STRING(20),
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'client' },
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  });
  return User;
};