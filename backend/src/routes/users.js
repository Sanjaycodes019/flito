const express = require('express');
const router = express.Router();

const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

router.use(authMiddleware);

// Owners look up a driver by exact phone match before assigning them to a
// booking. Restricted to role=driver results and a minimal public shape —
// this is a lookup, not a general user directory.
router.get('/lookup', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'phone query param is required' });
    }

    const driver = await User.findOne({ phone, role: 'driver' })
      .select('firstName lastName phone rating kycStatus status');

    if (!driver) {
      return res.status(404).json({ success: false, message: 'No driver found with that phone number' });
    }

    res.json({ success: true, driver });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
