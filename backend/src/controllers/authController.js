const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { codeFields, issueCode, redeemCode } = require('../services/verification');
const { verifyGoogleIdToken, isConfigured: googleConfigured } = require('../services/googleAuth');
const { publicUser } = require('../services/userView');
const { fail } = require('../utils/respond');
const adminGate = require('../services/adminGate');
const { languageOf } = require('../utils/language');

const signToken = (user) =>
  jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

exports.signup = async (req, res, next) => {
  try {
    const { email: rawEmail, password, role, firstName, lastName, phone } = req.body;
    const emailAddr = rawEmail.toLowerCase().trim();

    const existing = await User.findOne({ email: emailAddr });
    if (existing) {
      return fail(res, 409, 'AUTH_EMAIL_IN_USE', 'An account with that email already exists, please log in');
    }
    if (phone) {
      const phoneTaken = await User.findOne({ phone });
      if (phoneTaken) {
        return fail(res, 409, 'AUTH_PHONE_IN_USE', 'That phone number is already linked to another account');
      }
    }

    const user = await User.create({
      email: emailAddr,
      password,
      role,
      firstName,
      lastName,
      phone: phone || undefined,
    });

    // A failed verification email doesn't lose the account that was just
    // created; the app says so and the user can ask for a new code.
    let verificationEmailSent = true;
    try {
      await issueCode(user, 'verifyEmail', { language: languageOf(req) });
    } catch (err) {
      verificationEmailSent = false;
      logger.error('[signup] verification email failed:', err.message);
    }

    res.status(201).json({ success: true, token: signToken(user), user: publicUser(user), verificationEmailSent });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      return fail(res, 409, 'AUTH_DUPLICATE_FIELD', `That ${field} is already in use`, { field });
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email: rawEmail, password } = req.body;
    const emailAddr = rawEmail.toLowerCase().trim();

    // Generic message for both "no such account" and "wrong password": which
    // one is true should never be distinguishable to the caller.
    const invalid = () => fail(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Incorrect email or password');

    const user = await User.findOne({ email: emailAddr }).select('+password +googleId');
    if (!user || !(await user.comparePassword(password))) {
      return invalid();
    }
    if (user.status !== 'active') {
      return fail(res, 403, 'AUTH_ACCOUNT_STATUS', `Account is ${user.status}`, { status: user.status });
    }

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

// "Continue with Google" from either the login or signup screen. `role` is
// only used the first time this Google identity is seen (a genuinely new
// account); an existing account (by googleId, or by a matching verified
// email) simply logs in and ignores it.
exports.googleAuth = async (req, res, next) => {
  try {
    if (!googleConfigured()) {
      return fail(res, 503, 'AUTH_GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured yet');
    }

    const { idToken, role, firstName: firstNameOverride, lastName: lastNameOverride } = req.body;
    const profile = await verifyGoogleIdToken(idToken);

    let created = false;
    let user = await User.findOne({ googleId: profile.googleId }).select('+password +googleId');

    if (!user) {
      // Google verified this email, so linking it to an existing
      // email/password account (rather than erroring as a duplicate) is
      // safe and is what a user expects when they signed up one way and
      // later taps "Continue with Google" with the same address.
      user = await User.findOne({ email: profile.email }).select('+password +googleId');
      if (user) {
        user.googleId = profile.googleId;
        if (profile.emailVerified) user.emailVerified = true;
        await user.save();
      }
    }

    if (!user) {
      if (!role || !['shipper', 'owner', 'driver'].includes(role)) {
        // The token is already verified, so handing back the Google name and
        // email lets the signup screen show who is signing up while the user
        // picks a role, without a second trip through Google.
        return res.status(400).json({
          success: false,
          message: 'No account exists for this Google account yet. Choose a role to sign up.',
          code: 'ROLE_REQUIRED',
          profile: { email: profile.email, firstName: profile.firstName, lastName: profile.lastName },
        });
      }
      created = true;
      user = await User.create({
        googleId: profile.googleId,
        email: profile.email,
        emailVerified: profile.emailVerified,
        firstName: firstNameOverride || profile.firstName,
        lastName: lastNameOverride || profile.lastName,
        role,
      });
    }

    if (user.status !== 'active') {
      return fail(res, 403, 'AUTH_ACCOUNT_STATUS', `Account is ${user.status}`, { status: user.status });
    }

    res.status(created ? 201 : 200).json({ success: true, token: signToken(user), user: publicUser(user), isNewAccount: created });
  } catch (error) {
    if (error.statusCode) {
      // Forwards a message thrown by services/googleAuth.js verifyGoogleIdToken;
      // its three known (statusCode, message) pairs each get their own stable
      // code, and any future one still gets a safe generic fallback.
      const codeByStatus = {
        503: 'AUTH_GOOGLE_SERVICE_NOT_CONFIGURED',
        401: 'AUTH_GOOGLE_TOKEN_INVALID',
        400: 'AUTH_GOOGLE_NO_EMAIL',
      };
      return fail(res, error.statusCode, codeByStatus[error.statusCode] || 'AUTH_GOOGLE_ERROR', error.message);
    }
    if (error.code === 11000) {
      return fail(res, 409, 'AUTH_GOOGLE_EMAIL_IN_USE', 'That email is already used by another account');
    }
    next(error);
  }
};

// redeemCode() (services/verification.js) returns one of exactly two
// {status, message} pairs for a wrong code: 400 "invalid or expired", or
// 429 "too many wrong tries". The status uniquely identifies which, so a
// stable code can be picked without verification.js needing to know about
// codes at all.
const codeRedeemProblem = (problem) => (problem.status === 429 ? 'AUTH_CODE_TOO_MANY_ATTEMPTS' : 'AUTH_CODE_INVALID');

exports.verifyEmail = async (req, res, next) => {
  try {
    const { email: rawEmail, code } = req.body;
    const emailAddr = rawEmail.toLowerCase().trim();

    // An unknown email gets the same answer as a wrong code.
    const user = await User.findOne({ email: emailAddr }).select(codeFields('verifyEmail'));
    const problem = await redeemCode(user, 'verifyEmail', code);
    if (problem) return fail(res, problem.status, codeRedeemProblem(problem), problem.message);

    user.emailVerified = true;
    await user.save();

    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

// A cooldown (429) or a failed send (502) goes back with its own message, and
// the wait in seconds so the app can count it down. retryAfterSeconds stays a
// top-level field (not folded into `extra`): the frontend and the test suite
// both read res.body.retryAfterSeconds directly.
const sendCodeError = (res, error) => {
  const isCooldown = error.status === 429;
  res.status(error.status).json({
    success: false,
    code: isCooldown ? 'AUTH_CODE_RESEND_COOLDOWN' : 'AUTH_EMAIL_SEND_FAILED',
    message: error.message,
    ...(isCooldown ? { extra: { retryAfterSeconds: error.retryAfterSeconds } } : {}),
    retryAfterSeconds: error.retryAfterSeconds,
  });
};

exports.resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select(codeFields('verifyEmail'));
    if (!user) return fail(res, 404, 'AUTH_USER_NOT_FOUND', 'User not found');
    if (!user.email) return fail(res, 400, 'AUTH_NO_EMAIL', 'Add an email address first');
    if (user.emailVerified) return res.json({ success: true, alreadyVerified: true });

    await issueCode(user, 'verifyEmail', { language: languageOf(req) });
    res.json({ success: true });
  } catch (error) {
    if (error.status === 429 || error.status === 502) return sendCodeError(res, error);
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const emailAddr = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email: emailAddr }).select(codeFields('resetPassword'));

    // Same response whether or not the account exists, whether a code was
    // just sent, and whether the email went out: anything else would let
    // someone use this endpoint to find out which emails have accounts.
    const genericResponse = {
      success: true,
      code: 'AUTH_RESET_CODE_SENT_GENERIC',
      message: "If that email has an account, we've sent a reset code",
    };

    if (user) {
      try {
        await issueCode(user, 'resetPassword', { language: languageOf(req) });
      } catch (err) {
        if (err.status !== 429) logger.error('[forgot-password] email failed:', err.message);
      }
    }

    res.json(genericResponse);
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email: rawEmail, code, newPassword } = req.body;
    const emailAddr = rawEmail.toLowerCase().trim();

    const user = await User.findOne({ email: emailAddr }).select(codeFields('resetPassword'));
    const problem = await redeemCode(user, 'resetPassword', code);
    if (problem) return fail(res, problem.status, codeRedeemProblem(problem), problem.message);

    user.password = newPassword;
    // The code reached this inbox, which proves the address too.
    user.emailVerified = true;
    await user.save();

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('+password +googleId');
    if (!user) return fail(res, 404, 'AUTH_USER_NOT_FOUND', 'User not found');
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

// Admin portal. Separate from the public login on purpose: it needs the
// server's admin access key on top of the password, and it answers every
// failure (wrong key, no such account, wrong password, not an admin) with the
// same message so nobody can tell which part was wrong or who is an admin.
const adminDenied = (res) => fail(res, 401, 'AUTH_ADMIN_DENIED', 'Admin access denied');

exports.adminLogin = async (req, res, next) => {
  try {
    if (!adminGate.isConfigured()) return adminDenied(res);
    const { email: rawEmail, password, accessKey } = req.body;

    const keyOk = adminGate.keyMatches(accessKey);
    const user = await User.findOne({ email: rawEmail.toLowerCase().trim() }).select('+password');
    const passwordOk = user ? await user.comparePassword(password) : false;
    if (!keyOk || !passwordOk || user.role !== 'admin' || user.status !== 'active') {
      return adminDenied(res);
    }

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.adminSignup = async (req, res, next) => {
  try {
    if (!adminGate.isConfigured() || !adminGate.keyMatches(req.body.accessKey)) return adminDenied(res);
    const { email: rawEmail, password, firstName, lastName } = req.body;
    const emailAddr = rawEmail.toLowerCase().trim();

    if (await User.findOne({ email: emailAddr })) {
      return fail(res, 409, 'AUTH_EMAIL_IN_USE', 'An account with that email already exists, please log in');
    }

    const user = await User.create({
      email: emailAddr,
      password,
      role: 'admin',
      firstName,
      lastName: lastName || '',
      emailVerified: true,
      kycStatus: 'approved',
    });

    res.status(201).json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, 'AUTH_EMAIL_IN_USE', 'An account with that email already exists, please log in');
    }
    next(error);
  }
};
