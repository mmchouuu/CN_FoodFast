const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789@$!%*?&';

function generatePassword(length = 12) {
  const chars = [];
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    chars.push(ALPHABET[index]);
  }
  return chars.join('');
}

module.exports = {
  generatePassword,
};
