const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory OTP store keyed by phone. Fine for a single-instance MVP;
// swap for Redis (or a real SMS+OTP provider like Sparrow SMS) before scaling
// past one server instance, since this resets on every restart/deploy.
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

const generateOtp = () => (process.env.NODE_ENV === 'production'
  ? String(Math.floor(100000 + Math.random() * 900000))
  : '123456'); // fixed OTP in dev/test for convenience

const signToken = (user) =>
  jwt.sign(
    { userId: user._id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

const publicUser = (user) => ({
  _id: user._id,
  phone: user.phone,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  kycStatus: user.kycStatus,
  rating: user.rating,
});

exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const otp = generateOtp();
    otpStore.set(phone, { otp, expiresAt: Date.now() + OTP_TTL_MS });

    // TODO: integrate a real SMS gateway (e.g. Sparrow SMS) for production.
    const payload = { success: true, message: 'OTP sent' };
    if (process.env.NODE_ENV !== 'production') payload.otp = otp; // dev convenience only

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const consumeOtp = (phone, otp) => {
  const entry = otpStore.get(phone);
  if (!entry) return false;
  const valid = entry.otp === otp && entry.expiresAt > Date.now();
  if (valid) otpStore.delete(phone);
  return valid;
};

exports.signup = async (req, res, next) => {
  try {
    const { phone, otp, role, firstName, lastName } = req.body;

    if (!consumeOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists, please login' });
    }

    const user = await User.create({
      phone,
      role,
      firstName,
      lastName,
      isPhoneVerified: true,
    });

    res.status(201).json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!consumeOtp(phone, otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this number, please sign up' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: `Account is ${user.status}` });
    }

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};
