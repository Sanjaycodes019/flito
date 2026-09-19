const router = require('express').Router();
const User = require('../../models/User');
const { fail } = require('../../utils/respond');
const { paginationParams, paginationMeta, searchClause, enumFilter, allOf } = require('./helpers');

const FIELDS = 'firstName lastName email phone role status kycStatus companyName rating totalRatings createdAt';
const ROLES = ['shipper', 'owner', 'driver', 'admin'];
const STATUSES = ['active', 'suspended', 'banned'];
const KYC_STATUSES = ['not_submitted', 'pending', 'approved', 'rejected'];

// All users, newest signups first. Filters: ?q= (name, email, phone, company),
// ?role=, ?status=, ?kycStatus=.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = allOf(
      searchClause(req.query, ['firstName', 'lastName', 'email', 'phone', 'companyName']),
      enumFilter(req.query, 'role', ROLES),
      enumFilter(req.query, 'status', STATUSES),
      enumFilter(req.query, 'kycStatus', KYC_STATUSES),
    );
    const [users, total] = await Promise.all([
      User.find(filter).select(FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users, pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    next(error);
  }
});

// Suspend/ban/reactivate a user. Takes effect on their very next request (see
// middleware/auth). Answers with the same fields the users list shows.
router.patch('/:userId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return fail(res, 400, 'ADMIN_INVALID_STATUS', 'Invalid status');
    }
    // An admin who suspends their own account locks themselves out, with no
    // one guaranteed to be left to undo it.
    if (req.params.userId === req.user.userId) {
      return fail(res, 400, 'ADMIN_CANNOT_CHANGE_OWN_STATUS', "You can't change your own account's status");
    }
    const user = await User.findByIdAndUpdate(req.params.userId, { status }, { new: true }).select(FIELDS);
    if (!user) return fail(res, 404, 'ADMIN_USER_NOT_FOUND', 'User not found');
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
