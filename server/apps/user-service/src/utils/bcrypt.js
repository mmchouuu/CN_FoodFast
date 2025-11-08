<<<<<<< HEAD
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
module.exports = {
  hash: (plain) => bcrypt.hash(plain, SALT_ROUNDS),
  compare: (plain, hash) => bcrypt.compare(plain, hash)
};
=======
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
module.exports = {
  hash: (plain) => bcrypt.hash(plain, SALT_ROUNDS),
  compare: (plain, hash) => bcrypt.compare(plain, hash)
};
>>>>>>> e1903a6c2a79f913b83ae286c7238cad8b947f1d
