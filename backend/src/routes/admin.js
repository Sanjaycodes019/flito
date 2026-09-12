const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Load = require('../models/Load');
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

router.use(authMiddleware, requireRole('admin'));

// Platform metrics for a simple admin dashboard
router.get('/stats', async (req, res, next) => {
  try {
    const [userCount, loadCount, bookingCount, pendingKyc] = await Promise.all([
      User.countDocuments(),
      Load.countDocuments(),
      Booking.countDocuments(),
      User.countDocuments({ kycStatus: 'pending' }),
    ]);
    res.json({ success: true, stats: { userCount, loadCount, bookingCount, pendingKyc } });
  } catch (error) {
    next(error);
  }
});

// KYC queue
router.get('/kyc/pending', async (req, res, next) => {
  try {
    const users = await User.find({ kycStatus: 'pending' }).select('-password');
    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
});

router.patch('/kyc/:userId', async (req, res, next) => {
  try {
    const { decision } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be approved or rejected' });
    }
    const user = await User.findByIdAndUpdate(req.params.userId, { kycStatus: decision }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// Suspend/ban/reactivate a user
router.patch('/users/:userId/status', async (req, res, next) => {
  try {
    const { status } = req.body; // 'active' | 'suspended' | 'banned'
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const user = await User.findByIdAndUpdate(req.params.userId, { status }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
