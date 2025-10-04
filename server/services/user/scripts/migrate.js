const { sequelize } = require('../src/models');

async function migrate() {
  await sequelize.sync({ alter: true });
  console.log('migrations applied');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });