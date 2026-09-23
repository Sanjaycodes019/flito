const router = require('express').Router();
const User = require('../../models/User');
const { fail } = require('../../utils/respond');
const { newPin } = require('../../services/pin');
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

// For someone who forgot their PIN and called FLITO support: makes a new one
// for the admin to read out, once they have checked who is calling. The old
// PIN stops working and any lock is lifted.
router.post('/:userId/reset-pin', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return fail(res, 404, 'ADMIN_USER_NOT_FOUND', 'User not found');
    if (user.role === 'admin') return fail(res, 400, 'ADMIN_PIN_NOT_FOR_ADMINS', 'Admins log in with email and password only');
    if (!user.phone) return fail(res, 400, 'ADMIN_PIN_NEEDS_PHONE', 'This user has no phone number to log in with');

    const pin = newPin();
    user.pin = pin;
    user.pinFailedAttempts = undefined;
    user.pinLockedUntil = undefined;
    await user.save();

    res.json({ success: true, pin });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
