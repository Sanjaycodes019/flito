const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { validateSendOtp, validateSignup } = require('../middleware/validators');

// Auth endpoints are the most abuse-prone (OTP spam, credential stuffing) — rate-limit them.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});

router.use(authLimiter);

router.post('/send-otp', validateSendOtp, authController.sendOtp);
router.post('/signup', validateSignup, authController.signup);
router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
