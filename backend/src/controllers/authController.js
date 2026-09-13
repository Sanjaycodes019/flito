const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const otpStore = require('../services/otpStore');
const sms = require('../services/sms');
const { publicUser } = require('../services/userView');

// Math.random() is not suitable for a security credential — a 6-digit code is
// small enough to brute-force offline if it is predictable.
const generateOtp = () => (process.env.NODE_ENV === 'production'
  ? String(crypto.randomInt(100000, 1000000))
  : '123456'); // fixed OTP in dev/test for convenience

const signToken = (user) =>
  jwt.sign(
    { userId: user._id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

exports.sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const otp = generateOtp();
    await otpStore.set(phone, otp);
    await sms.sendOtpSms(phone, otp);

    const payload = { success: true, message: 'OTP sent' };
    // Returning the code is a development convenience only — never in
    // production, where it would hand any caller a valid credential.
    if (process.env.NODE_ENV !== 'production') payload.otp = otp;

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const consumeOtp = (phone, otp) => otpStore.consume(phone, otp);

exports.signup = async (req, res, next) => {
  try {
    const { phone, otp, role, firstName, lastName } = req.body;

    if (!(await consumeOtp(phone, otp))) {
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

    if (!(await consumeOtp(phone, otp))) {
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
