const router = require('express').Router();
const User = require('../../models/User');
const Load = require('../../models/Load');
const Truck = require('../../models/Truck');
const Booking = require('../../models/Booking');
const { fail } = require('../../utils/respond');
const { newPin } = require('../../services/pin');
const { describeAddress } = require('../../services/nepalLocations');
const { documentView } = require('../../services/kycView');
const { completedIdTypes, missingDocuments, requiredDocumentsFor } = require('../../services/kycPolicy');
const { historyFor, recordAdminAction } = require('../../services/audit');
const {
  paginationParams, paginationMeta, searchClause, enumFilter, idFilter, allOf, requireObjectId, fullName, PERSON_FIELDS, personSummary,
} = require('./helpers');
const { sortPayoutMethods, adminPayoutView } = require('../../services/payoutView');

const FIELDS = 'firstName lastName email phone role status kycStatus companyName rating totalRatings createdAt avatar addedBy';
const ROLES = ['shipper', 'owner', 'driver', 'admin'];
const STATUSES = ['active', 'suspended', 'banned'];
const KYC_STATUSES = ['not_submitted', 'pending', 'approved', 'rejected'];
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_transit'];
const OPEN_LOAD_STATUSES = ['open', 'quoted', 'negotiating'];
const MAX_NOTE_LENGTH = 500;

router.param('userId', requireObjectId('ADMIN_USER_NOT_FOUND', 'User not found'));

// A list row: who they are and where their account stands.
const userListView = (user) => {
  const plain = user.toObject();
  const { avatar, ...rest } = plain;
  return { ...rest, avatarUrl: avatar?.url || null };
};

// All users, newest signups first. Filters: ?q= (name, email, phone, company),
// ?role=, ?status=, ?kycStatus=, ?addedBy= (the drivers an owner added).
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = allOf(
      searchClause(req.query, ['firstName', 'lastName', 'email', 'phone', 'companyName']),
      enumFilter(req.query, 'role', ROLES),
      enumFilter(req.query, 'status', STATUSES),
      enumFilter(req.query, 'kycStatus', KYC_STATUSES),
      idFilter(req.query, 'addedBy'),
    );
    const [users, total] = await Promise.all([
      User.find(filter).select(FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users: users.map(userListView), pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    next(error);
  }
});

// Only the last four digits: enough to confirm a payout account on a call.
const maskAccount = (number) => (number ? `•••• ${String(number).slice(-4)}` : null);

// Everything an admin needs to know about one user. Secrets (password and PIN
// hashes, codes, tokens, storage identifiers) never leave the server; only
// whether they are set.
const adminUserView = (user) => ({
  _id: user._id,
  name: fullName(user) || null,
  firstName: user.firstName,
  lastName: user.lastName,
  companyName: user.companyName,
  role: user.role,
  status: user.status || 'active',
  email: user.email,
  emailVerified: Boolean(user.emailVerified),
  phone: user.phone,
  phoneVerified: Boolean(user.isPhoneVerified),
  avatarUrl: user.avatar?.url || null,
  address: describeAddress(user.address),
  bank: user.bankDetails?.bankName || user.bankDetails?.accountNumber
    ? { bankName: user.bankDetails.bankName || null, account: maskAccount(user.bankDetails.accountNumber) }
    : null,
  payoutMethods: sortPayoutMethods(user.payoutMethods).map(adminPayoutView),
  walletBalance: user.walletBalance || 0,
  rating: user.rating || 0,
  totalRatings: user.totalRatings || 0,
  signIn: { password: Boolean(user.password), pin: Boolean(user.pin), google: Boolean(user.googleId) },
  pinLocked: Boolean(user.pinLockedUntil && user.pinLockedUntil > new Date()),
  pushEnabled: Boolean(user.pushToken),
  memberSince: user.createdAt,
  updatedAt: user.updatedAt,
  addedBy: personSummary(user.addedBy),
  kyc: {
    status: user.kycStatus || 'not_submitted',
    rejectionReason: user.kycStatus === 'rejected' ? user.kycRejectionReason : undefined,
    submittedAt: user.kycSubmittedAt,
    reviewedAt: user.kycReviewedAt,
    reviewedBy: user.kycReviewedBy?._id ? { _id: user.kycReviewedBy._id, name: fullName(user.kycReviewedBy) || user.kycReviewedBy.email } : null,
    identityDocuments: completedIdTypes(user),
    requiredDocuments: requiredDocumentsFor(user),
    missingDocuments: missingDocuments(user),
    documents: (user.kycDocuments || []).map(documentView),
  },
});

// How much of the platform a user touches, by what their role does. Each
// count has a matching filtered list endpoint for the full, paginated records.
const relatedCounts = async (user) => {
  const asParty = { $or: [{ shipperId: user._id }, { ownerId: user._id }, { driverId: user._id }] };
  const [bookings, activeBookings, completedBookings] = await Promise.all([
    Booking.countDocuments(asParty),
    Booking.countDocuments({ ...asParty, status: { $in: ACTIVE_BOOKING_STATUSES } }),
    Booking.countDocuments({ ...asParty, status: 'completed' }),
  ]);
  const counts = { bookings, activeBookings, completedBookings };

  if (user.role === 'shipper') {
    const [loads, openLoads] = await Promise.all([
      Load.countDocuments({ shipperId: user._id }),
      Load.countDocuments({ shipperId: user._id, status: { $in: OPEN_LOAD_STATUSES } }),
    ]);
    Object.assign(counts, { loads, openLoads });
  }
  if (user.role === 'owner') {
    const [trucks, verifiedTrucks, drivers] = await Promise.all([
      Truck.countDocuments({ ownerId: user._id }),
      Truck.countDocuments({ ownerId: user._id, verificationStatus: 'approved' }),
      User.countDocuments({ addedBy: user._id }),
    ]);
    Object.assign(counts, { trucks, verifiedTrucks, drivers });
  }
  if (user.role === 'driver') {
    counts.trucks = await Truck.countDocuments({ assignedDriverId: user._id });
  }
  return counts;
};

// One user in full: profile, verification with document links, counts of
// what they touch, and the admin history of their account.
router.get('/:userId', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('+password +pin +googleId +pinLockedUntil')
      .populate('addedBy', PERSON_FIELDS)
      .populate('kycReviewedBy', 'firstName lastName email');
    if (!user) return fail(res, 404, 'ADMIN_USER_NOT_FOUND', 'User not found');

    const [counts, history] = await Promise.all([relatedCounts(user), historyFor('user', user._id)]);
    res.json({ success: true, user: adminUserView(user), counts, history });
  } catch (error) {
    next(error);
  }
});

// Suspend/ban/reactivate a user, with an optional note for the record. Takes
// effect on their very next request (see middleware/auth). Answers with the
// same fields the users list shows.
router.patch('/:userId/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return fail(res, 400, 'ADMIN_INVALID_STATUS', 'Invalid status');
    }
    const note = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, MAX_NOTE_LENGTH) : '';
    // An admin who suspends their own account locks themselves out, with no
    // one guaranteed to be left to undo it.
    if (req.params.userId === req.user.userId) {
      return fail(res, 400, 'ADMIN_CANNOT_CHANGE_OWN_STATUS', "You can't change your own account's status");
    }
    const before = await User.findById(req.params.userId).select('status');
    if (!before) return fail(res, 404, 'ADMIN_USER_NOT_FOUND', 'User not found');

    const user = await User.findByIdAndUpdate(req.params.userId, { status }, { new: true }).select(FIELDS);
    if ((before.status || 'active') !== status) {
      await recordAdminAction(req, {
        action: `user.${status === 'active' ? 'reactivated' : status}`,
        targetType: 'user',
        targetId: user._id,
        reason: note,
        meta: { from: before.status || 'active', to: status },
      });
    }
    res.json({ success: true, user: userListView(user) });
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
    // The PIN itself is never logged.
    await recordAdminAction(req, { action: 'user.pinReset', targetType: 'user', targetId: user._id });

    res.json({ success: true, pin });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
