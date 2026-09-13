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
  // The suite drives many signups from one address; the limit stays active in
  // development and production.
  skip: () => process.env.NODE_ENV === 'test',
});

// Only the unauthenticated, credential-guessing endpoints are rate-limited.
// GET /me requires an already-valid JWT and is called on every app cold
// start (App.js's session bootstrap) — limiting it too meant one burst of
// OTP attempts from anyone on a shared IP locked every logged-in user out of
// even opening the app for the rest of the window.
router.post('/send-otp', authLimiter, validateSendOtp, authController.sendOtp);
router.post('/signup', authLimiter, validateSignup, authController.signup);
router.post('/login', authLimiter, authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
