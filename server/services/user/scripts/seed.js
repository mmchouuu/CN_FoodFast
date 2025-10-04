const bcrypt = require('bcrypt');
const { User } = require('../src/models');

async function seed() {
  const hash = await bcrypt.hash('password123', 10);
  await User.create({ first_name: 'Admin', last_name: 'User', email: 'admin@local', phone: '0123456789', password_hash: hash, role: 'admin' });
  console.log('seed done');
  process.exit(0);
}
seed().catch(e => { console.error(e); process.exit(1); });