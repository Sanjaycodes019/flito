const crypto = require('crypto');

// The admin portal is closed unless ADMIN_ACCESS_KEY is set on the server.
// Compares digests so the check takes the same time however much of the key
// a guess gets right.
const isConfigured = () => Boolean(process.env.ADMIN_ACCESS_KEY);

const keyMatches = (given) => {
  const expected = process.env.ADMIN_ACCESS_KEY;
  if (!expected || typeof given !== 'string') return false;
  const digest = (v) => crypto.createHash('sha256').update(v).digest();
  return crypto.timingSafeEqual(digest(given), digest(expected));
};

module.exports = { isConfigured, keyMatches };
