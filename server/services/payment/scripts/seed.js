const { Payment } = require('../src/models');

async function seed() {
  // no initial seed required; optionally create sample payment record
  console.log('no seed created for payment');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
