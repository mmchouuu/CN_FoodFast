const { sequelize } = require('../src/models');
(async () => {
  await sequelize.sync({ alter: true });
  console.log('product migrations applied');
  process.exit(0);
})();
