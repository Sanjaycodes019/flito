const router = require('express').Router();
const Booking = require('../../models/Booking');
const { PARTY_FIELDS, withVerification } = require('../../services/partyView');
const { paginationParams, paginationMeta, enumFilter } = require('./helpers');

const STATUSES = ['pending', 'confirmed', 'in_transit', 'completed', 'cancelled'];
const TRUCK_FIELDS = 'registrationNumber truckType capacity makeModel verificationStatus';

// Every booking on the platform, newest first. Filter: ?status=.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = enumFilter(req.query, 'status', STATUSES) || {};
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('loadId', 'goodsType weight')
        .populate('shipperId', PARTY_FIELDS)
        .populate('ownerId', PARTY_FIELDS)
        .populate('driverId', PARTY_FIELDS)
        .populate('truckId', TRUCK_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);
    res.json({
      success: true,
      bookings: bookings.map((booking) => withVerification(booking, { people: ['shipperId', 'ownerId', 'driverId'], trucks: ['truckId'] })),
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
