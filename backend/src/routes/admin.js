const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Load = require('../models/Load');
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { reviewView } = require('../services/kycView');

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

// Submissions awaiting review, oldest first, each with fresh document links.
router.get('/kyc/pending', async (req, res, next) => {
  try {
    const users = await User.find({ kycStatus: 'pending' }).sort({ kycSubmittedAt: 1 }).limit(100);
    res.json({ success: true, users: users.map(reviewView) });
  } catch (error) {
    next(error);
  }
});

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

router.patch('/kyc/:userId', async (req, res, next) => {
  try {
    const { decision } = req.body;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be approved or rejected' });
    }
    // Without a reason a rejected user has no idea what to fix.
    if (decision === 'rejected' && reason.length < MIN_REASON_LENGTH) {
      return res.status(400).json({ success: false, message: `Give the user a reason for the rejection (at least ${MIN_REASON_LENGTH} characters) so they know what to fix` });
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return res.status(400).json({ success: false, message: `The reason must be at most ${MAX_REASON_LENGTH} characters` });
    }

    const reviewed = { kycReviewedAt: new Date(), kycReviewedBy: req.user.userId };
    const update = decision === 'approved'
      ? { $set: { kycStatus: 'approved', ...reviewed }, $unset: { kycRejectionReason: '' } }
      : { $set: { kycStatus: 'rejected', kycRejectionReason: reason, ...reviewed } };

    // Only a submission awaiting review can be decided: an admin can't approve
    // someone who never sent documents, or silently reverse a closed review.
    const user = await User.findOneAndUpdate({ _id: req.params.userId, kycStatus: 'pending' }, update, { new: true });

    if (!user) {
      const exists = await User.exists({ _id: req.params.userId });
      return exists
        ? res.status(400).json({ success: false, message: 'This user has no verification awaiting review' })
        : res.status(404).json({ success: false, message: 'User not found' });
    }

    req.io?.to(`user-${user._id}`).emit('kyc-reviewed', {
      status: user.kycStatus,
      reason: user.kycRejectionReason,
    });

    res.json({
      success: true,
      user: { _id: user._id, kycStatus: user.kycStatus, kycRejectionReason: user.kycRejectionReason },
    });
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
