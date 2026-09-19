const router = require('express').Router();
const User = require('../../models/User');
const { reviewView } = require('../../services/kycView');
const { sendPushToUser } = require('../../services/push');
const { fail } = require('../../utils/respond');
const { paginationParams, paginationMeta, searchClause, allOf, readDecision } = require('./helpers');

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

const listByStatus = (defaultStatus) => async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const status = REVIEW_STATUSES.includes(req.query.status) ? req.query.status : defaultStatus;
    const filter = allOf({ kycStatus: status }, searchClause(req.query, ['firstName', 'lastName', 'email', 'phone', 'companyName']));
    const [users, total] = await Promise.all([
      User.find(filter).sort({ kycSubmittedAt: -1 }).skip(skip).limit(limit),
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

    if (!user) {
      const exists = await User.exists({ _id: req.params.userId });
      return exists
        ? fail(res, 400, 'ADMIN_KYC_NOT_PENDING', 'This user has no verification awaiting review')
        : fail(res, 404, 'ADMIN_USER_NOT_FOUND', 'User not found');
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

module.exports = router;
