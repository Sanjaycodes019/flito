const jwt = require('jsonwebtoken');
const User = require('../models/User');
const email = require('../services/email');
const { generateCode, CODE_TTL_MS, issueVerificationCode } = require('../services/verification');
const { verifyGoogleIdToken, isConfigured: googleConfigured } = require('../services/googleAuth');
const { publicUser } = require('../services/userView');

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
      return res.status(409).json({ success: false, message: 'An account with that email already exists, please log in' });
    }
    if (phone) {
      const phoneTaken = await User.findOne({ phone });
      if (phoneTaken) {
        return res.status(409).json({ success: false, message: 'That phone number is already linked to another account' });
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

    const devPayload = {};
    try {
      const code = await issueVerificationCode(user);
      if (process.env.NODE_ENV !== 'production') devPayload.verificationCode = code;
    } catch (err) {
      // A failed verification email should not lose the account that was
      // just created; the user can request a new code from the app.
      console.error('[signup] verification email failed:', err.message);
    }

    res.status(201).json({ success: true, token: signToken(user), user: publicUser(user), ...devPayload });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      return res.status(409).json({ success: false, message: `That ${field} is already in use` });
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
    const invalid = () => res.status(401).json({ success: false, message: 'Incorrect email or password' });

    const user = await User.findOne({ email: emailAddr }).select('+password +googleId');
    if (!user || !(await user.comparePassword(password))) {
      return invalid();
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
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
      return res.status(503).json({ success: false, message: 'Google sign-in is not configured yet' });
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
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }

    res.status(created ? 201 : 200).json({ success: true, token: signToken(user), user: publicUser(user), isNewAccount: created });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'That email is already used by another account' });
    }
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { email: rawEmail, code } = req.body;
    const emailAddr = rawEmail.toLowerCase().trim();

    const user = await User.findOne({ email: emailAddr }).select('+emailVerificationCode +emailVerificationExpires');
    const valid = user
      && user.emailVerificationCode === code
      && user.emailVerificationExpires
      && user.emailVerificationExpires.getTime() > Date.now();

    if (!valid) {
      return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
    }

    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.email) return res.status(400).json({ success: false, message: 'Add an email address first' });
    if (user.emailVerified) return res.json({ success: true, alreadyVerified: true });

    const devPayload = {};
    const code = await issueVerificationCode(user);
    if (process.env.NODE_ENV !== 'production') devPayload.verificationCode = code;

    res.json({ success: true, ...devPayload });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const emailAddr = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ email: emailAddr });

    // Same response whether or not the account exists: revealing that would
    // let an attacker use this endpoint to enumerate registered emails.
    const genericResponse = { success: true, message: "If that email has an account, we've sent a reset code" };

    if (!user) return res.json(genericResponse);

    const code = generateCode();
    user.passwordResetCode = code;
    user.passwordResetExpires = new Date(Date.now() + CODE_TTL_MS);
    await user.save();

    const devPayload = {};
    try {
      await email.sendPasswordResetEmail(user.email, user.firstName, code);
    } catch (err) {
      console.error('[forgot-password] email failed:', err.message);
    }
    if (process.env.NODE_ENV !== 'production') devPayload.resetCode = code;

    res.json({ ...genericResponse, ...devPayload });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email: rawEmail, code, newPassword } = req.body;
    const emailAddr = rawEmail.toLowerCase().trim();

    const user = await User.findOne({ email: emailAddr }).select('+passwordResetCode +passwordResetExpires');
    const valid = user
      && user.passwordResetCode === code
      && user.passwordResetExpires
      && user.passwordResetExpires.getTime() > Date.now();

    if (!valid) {
      return res.status(400).json({ success: false, message: 'That code is invalid or has expired' });
    }

    user.password = newPassword;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('+password +googleId');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};
