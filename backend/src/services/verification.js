const crypto = require('crypto');
const email = require('./email');

// One-time codes sent by email: six random digits to verify an email address
// or to reset a password.
//
// Only a hash of each code is stored, so reading the database never reveals a
// live code, and codes are never returned by the API: the email is the only
// way to get one. A code expires after CODE_TTL_MS, stops working after
// MAX_CODE_ATTEMPTS wrong tries, is used up once it's right, and a new one can
// be sent only after RESEND_COOLDOWN_MS (the app counts down the same wait).

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const PURPOSES = {
  verifyEmail: {
    hash: 'emailVerificationCode',
    expires: 'emailVerificationExpires',
    sentAt: 'emailVerificationSentAt',
    attempts: 'emailVerificationAttempts',
    send: (user, code, language) => email.sendVerificationEmail(user.email, user.firstName, code, language),
  },
  resetPassword: {
    hash: 'passwordResetCode',
    expires: 'passwordResetExpires',
    sentAt: 'passwordResetSentAt',
    attempts: 'passwordResetAttempts',
    send: (user, code, language) => email.sendPasswordResetEmail(user.email, user.firstName, code, language),
  },
};

// The hidden user fields to select before issuing or checking a code.
const codeFields = (purpose) => {
  const fields = PURPOSES[purpose];
  return `+${fields.hash} +${fields.expires} +${fields.sentAt} +${fields.attempts}`;
};

// Six digits, leading zeros included, from a cryptographic random source.
const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// Bound to the purpose and the account, so a code for one can't be replayed
// for the other.
const hashCode = (purpose, userId, code) => crypto
  .createHash('sha256')
  .update(`${purpose}:${userId}:${code}`)
  .digest('hex');

const httpError = (status, code, message, extra = {}) => Object.assign(new Error(message), { status, errorCode: code, ...extra });

// Whole seconds until another code can be sent, or 0.
const cooldownRemaining = (user, purpose, now = Date.now()) => {
  const sentAt = user.get(PURPOSES[purpose].sentAt);
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil((new Date(sentAt).getTime() + RESEND_COOLDOWN_MS - now) / 1000));
};

// Creates, stores and emails a fresh code, replacing any earlier one. The user
// must be loaded with codeFields(purpose). Throws a 429 inside the cooldown
// (unless `ignoreCooldown`, for a brand-new address), and a 502 when the email
// couldn't be sent, which also lifts the cooldown so the user can retry now.
// `language` ('en' or 'ne') picks the language of the email.
const issueCode = async (user, purpose, { ignoreCooldown = false, language = 'en' } = {}) => {
  const fields = PURPOSES[purpose];

  const wait = cooldownRemaining(user, purpose);
  if (!ignoreCooldown && wait > 0) {
    throw httpError(429, 'VERIFICATION_RESEND_COOLDOWN', `Please wait ${wait} seconds before asking for another code`, { retryAfterSeconds: wait });
  }

  const code = generateCode();
  user.set(fields.hash, hashCode(purpose, user._id, code));
  user.set(fields.expires, new Date(Date.now() + CODE_TTL_MS));
  user.set(fields.sentAt, new Date());
  user.set(fields.attempts, 0);
  await user.save();

  try {
    await fields.send(user, code, language);
  } catch (error) {
    user.set(fields.sentAt, undefined);
    await user.save();
    throw httpError(502, 'VERIFICATION_EMAIL_SEND_FAILED', 'We could not send the email right now. Please try again in a moment.');
  }
};

const INVALID = { status: 400, message: 'That code is invalid or has expired' };

// Checks a code the user typed. Returns null when it's right, having cleared it
// so it can't be used again (the caller saves the user with its own changes),
// or { status, message } when it's wrong, expired, or locked after too many
// wrong tries. The user must be loaded with codeFields(purpose).
const redeemCode = async (user, purpose, code) => {
  if (!user) return INVALID;
  const fields = PURPOSES[purpose];

  const storedHash = user.get(fields.hash);
  const expires = user.get(fields.expires);
  if (!storedHash || !expires || new Date(expires).getTime() <= Date.now()) return INVALID;

  if ((user.get(fields.attempts) || 0) >= MAX_CODE_ATTEMPTS) {
    return { status: 429, message: 'Too many wrong codes. Ask for a new code and try again.' };
  }

  const given = Buffer.from(hashCode(purpose, user._id, String(code)), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    // Counted atomically, so guesses sent in parallel all count.
    await user.constructor.updateOne({ _id: user._id }, { $inc: { [fields.attempts]: 1 } });
    return INVALID;
  }

  user.set(fields.hash, undefined);
  user.set(fields.expires, undefined);
  user.set(fields.sentAt, undefined);
  user.set(fields.attempts, undefined);
  return null;
};

module.exports = {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_CODE_ATTEMPTS,
  codeFields,
  generateCode,
  issueCode,
  redeemCode,
};
