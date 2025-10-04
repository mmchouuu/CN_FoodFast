const { sequelize } = require('../src/models');
(async () => {
  await sequelize.sync({ alter: true });
  console.log('order migrations applied');
  process.exit(0);
})();
