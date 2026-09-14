const crypto = require('crypto');
const email = require('./email');

// Shared by authController (signup, resend) and usersController (email
// change): a 6-digit code, the same shape as the old phone OTP. A fixed code
// in dev/test keeps the suite and manual testing independent of server logs.
const generateCode = () => (process.env.NODE_ENV === 'production'
  ? String(crypto.randomInt(100000, 1000000))
  : '123456');

const CODE_TTL_MS = 15 * 60 * 1000;

// Sets a fresh code on the user, saves it, and emails it. A resend simply
// overwrites the previous code rather than extending its clock. Throws if
// the save fails; the caller decides whether an email-send failure (caught
// separately, logged, not thrown) should block the surrounding request.
const issueVerificationCode = async (user) => {
  const code = generateCode();
  user.emailVerificationCode = code;
  user.emailVerificationExpires = new Date(Date.now() + CODE_TTL_MS);
  await user.save();
  await email.sendVerificationEmail(user.email, user.firstName, code);
  return code;
};

module.exports = { generateCode, CODE_TTL_MS, issueVerificationCode };
