module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: DataTypes.TEXT,
    price: { type: DataTypes.DECIMAL(12,2), allowNull: false },
    images: DataTypes.ARRAY(DataTypes.STRING),
    category: DataTypes.STRING(100),
    in_stock: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'products', timestamps: true, underscored: true });
  return Product;
};
