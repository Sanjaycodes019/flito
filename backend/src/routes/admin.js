const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Load = require('../models/Load');
const Booking = require('../models/Booking');
const Truck = require('../models/Truck');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { reviewView } = require('../services/kycView');
const { truckReviewView } = require('../services/truckView');
const { sendPushToUser } = require('../services/push');

router.use(authMiddleware, requireRole('admin'));

// Platform metrics for a simple admin dashboard
router.get('/stats', async (req, res, next) => {
  try {
    const [userCount, loadCount, bookingCount, pendingKyc, pendingTrucks] = await Promise.all([
      User.countDocuments(),
      Load.countDocuments(),
      Booking.countDocuments(),
      User.countDocuments({ kycStatus: 'pending' }),
      Truck.countDocuments({ verificationStatus: 'pending' }),
    ]);
    res.json({ success: true, stats: { userCount, loadCount, bookingCount, pendingKyc, pendingTrucks } });
  } catch (error) {
    next(error);
  }
});

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

// A review decision from the request body, or an error for the admin.
// Without a reason a rejected user has no idea what to fix.
const readDecision = (body, who) => {
  const { decision } = body;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!['approved', 'rejected'].includes(decision)) return { error: 'decision must be approved or rejected' };
  if (decision === 'rejected' && reason.length < MIN_REASON_LENGTH) {
    return { error: `Give the ${who} a reason for the rejection (at least ${MIN_REASON_LENGTH} characters) so they know what to fix` };
  }
  if (reason.length > MAX_REASON_LENGTH) return { error: `The reason must be at most ${MAX_REASON_LENGTH} characters` };
  return { decision, reason };
};

// Submissions awaiting review, oldest first, each with fresh document links.
router.get('/kyc/pending', async (req, res, next) => {
  try {
    const users = await User.find({ kycStatus: 'pending' }).sort({ kycSubmittedAt: 1 }).limit(100);
    res.json({ success: true, users: users.map(reviewView) });
  } catch (error) {
    next(error);
  }
});

router.patch('/kyc/:userId', async (req, res, next) => {
  try {
    const { decision, reason, error } = readDecision(req.body, 'user');
    if (error) return res.status(400).json({ success: false, message: error });

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
    await sendPushToUser(user._id, user.kycStatus === 'approved'
      ? { title: 'Identity verified', body: 'Your identity verification was approved', data: { type: 'kyc' } }
      : { title: 'Verification needs changes', body: user.kycRejectionReason, data: { type: 'kyc' } });

    res.json({
      success: true,
      user: { _id: user._id, kycStatus: user.kycStatus, kycRejectionReason: user.kycRejectionReason },
    });
  } catch (error) {
    next(error);
  }
});

// Trucks awaiting review, oldest first, with their owner and fresh paper links.
router.get('/trucks/pending', async (req, res, next) => {
  try {
    const trucks = await Truck.find({ verificationStatus: 'pending' })
      .populate('ownerId', 'firstName lastName companyName phone email kycStatus')
      .sort({ verificationSubmittedAt: 1 })
      .limit(100);
    res.json({ success: true, trucks: trucks.map(truckReviewView) });
  } catch (error) {
    next(error);
  }
});

router.patch('/trucks/:truckId', async (req, res, next) => {
  try {
    const { decision, reason, error } = readDecision(req.body, 'owner');
    if (error) return res.status(400).json({ success: false, message: error });

    const reviewed = { verificationReviewedAt: new Date(), verificationReviewedBy: req.user.userId };
    const update = decision === 'approved'
      ? { $set: { verificationStatus: 'approved', ...reviewed }, $unset: { verificationRejectionReason: '' } }
      : { $set: { verificationStatus: 'rejected', verificationRejectionReason: reason, ...reviewed } };

    // Only a truck awaiting review can be decided.
    const truck = await Truck.findOneAndUpdate({ _id: req.params.truckId, verificationStatus: 'pending' }, update, { new: true });

    if (!truck) {
      const exists = await Truck.exists({ _id: req.params.truckId });
      return exists
        ? res.status(400).json({ success: false, message: 'This truck has no verification awaiting review' })
        : res.status(404).json({ success: false, message: 'Truck not found' });
    }

    req.io?.to(`user-${truck.ownerId}`).emit('truck-reviewed', {
      truckId: truck._id,
      status: truck.verificationStatus,
      reason: truck.verificationRejectionReason,
    });
    await sendPushToUser(truck.ownerId, truck.verificationStatus === 'approved'
      ? { title: 'Truck verified', body: `${truck.registrationNumber} now shows the verified badge`, data: { type: 'fleet' } }
      : { title: 'Truck verification needs changes', body: `${truck.registrationNumber}: ${truck.verificationRejectionReason}`, data: { type: 'fleet' } });

    res.json({
      success: true,
      truck: { _id: truck._id, verificationStatus: truck.verificationStatus, verificationRejectionReason: truck.verificationRejectionReason },
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
