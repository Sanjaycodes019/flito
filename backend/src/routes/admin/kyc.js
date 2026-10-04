const router = require('express').Router();
const User = require('../../models/User');
const { reviewView } = require('../../services/kycView');
const { sendPushToUser } = require('../../services/push');
const { recordAdminAction } = require('../../services/audit');
const { fail } = require('../../utils/respond');
const {
  paginationParams, paginationMeta, searchClause, allOf, readDecision, readReason, requireObjectId,
} = require('./helpers');

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

router.param('userId', requireObjectId('ADMIN_USER_NOT_FOUND', 'User not found'));

const listByStatus = (defaultStatus) => async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const status = REVIEW_STATUSES.includes(req.query.status) ? req.query.status : defaultStatus;
    const filter = allOf({ kycStatus: status }, searchClause(req.query, ['firstName', 'lastName', 'email', 'phone', 'companyName']));
    const [users, total] = await Promise.all([
      User.find(filter).populate('addedBy', 'firstName lastName companyName phone').sort({ kycSubmittedAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users: users.map(reviewView), pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    next(error);
  }
};

// Verification submissions, newest first, each with fresh document links.
// ?status= pending (default) | approved | rejected, plus ?q=.
router.get('/', listByStatus('pending'));
// The original queue URL, kept so nothing that already calls it breaks.
router.get('/pending', listByStatus('pending'));

// Tells the user, and the owner who added them if they are a fleet driver,
// how their verification now stands.
const announce = async (req, user, { revoked = false } = {}) => {
  req.io?.to(`user-${user._id}`).emit('kyc-reviewed', { status: user.kycStatus, reason: user.kycRejectionReason });

  const approved = user.kycStatus === 'approved';
  await sendPushToUser(user._id, approved
    ? { title: 'Identity verified', body: 'Your identity verification was approved', data: { type: 'kyc' } }
    : {
      title: revoked ? 'Verification removed' : 'Verification needs changes',
      body: user.kycRejectionReason,
      data: { type: 'kyc' },
    });

  // A driver an owner added is managed by that owner, who is the one to act.
  if (user.addedBy) {
    const name = user.firstName;
    await sendPushToUser(user.addedBy, approved
      ? { title: 'Driver ready', body: `${name}'s license was approved. ${name} can now drive your bookings.`, data: { type: 'fleetDriver' } }
      : {
        title: revoked ? "Driver's verification removed" : 'Driver license photo rejected',
        body: `${name}: ${user.kycRejectionReason}`,
        data: { type: 'fleetDriver' },
      });
  }
};

const decisionView = (user) => ({ _id: user._id, kycStatus: user.kycStatus, kycRejectionReason: user.kycRejectionReason });

const refuseMissing = async (res, userId, code, message) => (
  (await User.exists({ _id: userId }))
    ? fail(res, 400, code, message)
    : fail(res, 404, 'ADMIN_USER_NOT_FOUND', 'User not found')
);

router.patch('/:userId', async (req, res, next) => {
  try {
    const { decision, reason, error, code, extra } = readDecision(req.body, 'user');
    if (error) return fail(res, 400, code, error, extra);

    const reviewed = { kycReviewedAt: new Date(), kycReviewedBy: req.user.userId };
    const update = decision === 'approved'
      ? { $set: { kycStatus: 'approved', ...reviewed }, $unset: { kycRejectionReason: '' } }
      : { $set: { kycStatus: 'rejected', kycRejectionReason: reason, ...reviewed } };

    // Only a submission awaiting review can be decided: an admin can't approve
    // someone who never sent documents, or silently reverse a closed review.
    const user = await User.findOneAndUpdate({ _id: req.params.userId, kycStatus: 'pending' }, update, { new: true });
    if (!user) return refuseMissing(res, req.params.userId, 'ADMIN_KYC_NOT_PENDING', 'This user has no verification awaiting review');

    await recordAdminAction(req, { action: `kyc.${decision}`, targetType: 'user', targetId: user._id, reason });
    await announce(req, user);

    res.json({ success: true, user: decisionView(user) });
  } catch (error) {
    next(error);
  }
});

// Takes a verification back: for a document found to be fake or expired, or
// someone who should no longer be trusted. The user is told why and can send
// new documents. Until then their trucks drop out of matches and, as a
// driver, they can't be put on a booking.
router.post('/:userId/revoke', async (req, res, next) => {
  try {
    const { reason, error, code, extra } = readReason(req.body, 'user');
    if (error) return fail(res, 400, code, error, extra);

    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, kycStatus: 'approved' },
      { $set: { kycStatus: 'rejected', kycRejectionReason: reason, kycReviewedAt: new Date(), kycReviewedBy: req.user.userId } },
      { new: true },
    );
    if (!user) return refuseMissing(res, req.params.userId, 'ADMIN_KYC_NOT_APPROVED', 'This user is not verified');

    await recordAdminAction(req, { action: 'kyc.revoked', targetType: 'user', targetId: user._id, reason });
    await announce(req, user, { revoked: true });

    res.json({ success: true, user: decisionView(user) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
