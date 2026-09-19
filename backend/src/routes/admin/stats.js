const router = require('express').Router();
const User = require('../../models/User');
const Load = require('../../models/Load');
const Booking = require('../../models/Booking');
const Truck = require('../../models/Truck');

// { value: count } for one field, so the admin filter chips can show how many
// records each choice holds. A record missing the field counts as `fallback`.
const countBy = async (Model, field, fallback) => {
  const rows = await Model.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((row) => [row._id ?? fallback, row.count]));
};

// Platform metrics for the admin overview and filter counts. Keys are
// additive: new counters can be added without breaking older clients.
router.get('/', async (req, res, next) => {
  try {
    const [
      userCount, loadCount, bookingCount, truckCount, pendingKyc, pendingTrucks, openLoads, activeBookings,
      userRoles, userStatuses, userKyc, loadStatuses, bookingStatuses, truckVerification,
    ] = await Promise.all([
      User.countDocuments(),
      Load.countDocuments(),
      Booking.countDocuments(),
      Truck.countDocuments(),
      User.countDocuments({ kycStatus: 'pending' }),
      Truck.countDocuments({ verificationStatus: 'pending' }),
      Load.countDocuments({ status: { $in: ['open', 'quoted', 'negotiating'] } }),
      Booking.countDocuments({ status: { $in: ['pending', 'confirmed', 'in_transit'] } }),
      countBy(User, 'role'),
      countBy(User, 'status', 'active'),
      countBy(User, 'kycStatus', 'not_submitted'),
      countBy(Load, 'status'),
      countBy(Booking, 'status'),
      countBy(Truck, 'verificationStatus', 'not_submitted'),
    ]);
    res.json({
      success: true,
      stats: {
        userCount, loadCount, bookingCount, truckCount, pendingKyc, pendingTrucks, openLoads, activeBookings,
        // Record counts per filter choice, keyed <resource>.<filter>.<value>.
        breakdown: {
          users: { role: userRoles, status: userStatuses, kycStatus: userKyc },
          loads: { status: loadStatuses },
          bookings: { status: bookingStatuses },
          kyc: { status: { pending: userKyc.pending || 0, approved: userKyc.approved || 0, rejected: userKyc.rejected || 0 } },
          trucks: { status: truckVerification },
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
