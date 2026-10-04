const router = require('express').Router();
const Booking = require('../../models/Booking');
const Payment = require('../../models/Payment');
const { PARTY_FIELDS, withVerification } = require('../../services/partyView');
const { standingOffer } = require('../../services/negotiation');
const { releaseBooking } = require('../../services/bookingRelease');
const { sendPushToUsers } = require('../../services/push');
const { historyFor, recordAdminAction } = require('../../services/audit');
const { fail } = require('../../utils/respond');
const {
  paginationParams, paginationMeta, enumFilter, idFilter, allOf, readReason, requireObjectId, PERSON_FIELDS, personSummary,
} = require('./helpers');

const STATUSES = ['pending', 'confirmed', 'in_transit', 'completed', 'cancelled'];
const TRUCK_FIELDS = 'registrationNumber truckType capacity makeModel verificationStatus';
// An admin can stop a booking that hasn't been delivered, e.g. after fraud
// or a dispute. A delivered one is history.
const ADMIN_CANCELLABLE = ['pending', 'confirmed', 'in_transit'];

router.param('bookingId', requireObjectId('ADMIN_BOOKING_NOT_FOUND', 'Booking not found'));

// A booking someone is on in any role.
const partyFilter = (query) => (idFilter(query, 'userId')
  ? { $or: [{ shipperId: query.userId }, { ownerId: query.userId }, { driverId: query.userId }] }
  : null);

// Every booking on the platform, newest first. Filters: ?status=, ?userId=
// (any party), ?truckId=, ?loadId=.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = allOf(
      enumFilter(req.query, 'status', STATUSES),
      partyFilter(req.query),
      idFilter(req.query, 'truckId'),
      idFilter(req.query, 'loadId'),
    );
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('loadId', 'goodsType weight pickupLocation.label dropoffLocation.label pickupDay')
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

const stopView = (stop) => (stop ? {
  address: stop.address || null,
  label: stop.label || null,
  contactPerson: stop.contactPerson || null,
  phone: stop.phone || null,
  coordinates: stop.coordinates?.lat != null ? stop.coordinates : null,
} : null);

// One booking in full: the job, everyone on it with how to reach them, the
// agreed price and what has been paid, how the trip is going, the proof of
// delivery, and the ratings both sides left.
const adminBookingView = (booking, payments) => {
  const load = booking.loadId;
  const quote = booking.quoteId;
  const truck = booking.truckId;
  return {
    _id: booking._id,
    status: booking.status,
    pickupStatus: booking.pickupStatus,
    dropoffStatus: booking.dropoffStatus,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    shipper: personSummary(booking.shipperId),
    owner: personSummary(booking.ownerId),
    driver: personSummary(booking.driverId),
    truck: truck?._id ? {
      _id: truck._id,
      registrationNumber: truck.registrationNumber,
      truckType: truck.truckType,
      capacity: truck.capacity,
      makeModel: truck.makeModel,
      verificationStatus: truck.verificationStatus || 'not_submitted',
    } : null,
    load: load?._id ? {
      _id: load._id,
      goodsType: load.goodsType,
      description: load.description,
      weight: load.weight,
      trucksNeeded: load.trucksNeeded || 1,
      trucksBooked: load.trucksBooked || 0,
      status: load.status,
      pickupDay: load.pickupDay,
      distanceKm: load.distanceKm,
      tripDays: load.tripDays,
      pickup: stopView(load.pickupLocation),
      dropoff: stopView(load.dropoffLocation),
    } : null,
    offer: quote?._id ? {
      _id: quote._id,
      openedBy: quote.initiatedBy || 'owner',
      price: standingOffer(quote).price,
      acceptedAt: quote.acceptedAt,
      acceptedBy: quote.acceptedBy,
    } : null,
    payment: {
      total: booking.totalAmount || 0,
      paid: booking.amountPaid || 0,
      pending: booking.amountPending ?? Math.max(0, (booking.totalAmount || 0) - (booking.amountPaid || 0)),
      method: booking.paymentMethod || null,
      status: booking.paymentStatus || 'pending',
      records: payments.map((payment) => ({
        _id: payment._id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        transactionId: payment.transactionId || null,
        at: payment.createdAt,
      })),
    },
    location: booking.currentLocation?.lat != null ? { ...booking.currentLocation, updatedAt: booking.locationUpdatedAt } : null,
    deliveryPhotos: (booking.deliveryPhotos || []).map(({ _id, url, uploadedAt }) => ({ _id, url, uploadedAt })),
    deliverySignature: booking.deliverySignature?.url
      ? { url: booking.deliverySignature.url, capturedAt: booking.deliverySignature.capturedAt }
      : null,
    ratings: {
      byShipper: booking.shipperRating?.rating ? booking.shipperRating : null,
      byOwner: booking.ownerRating?.rating ? booking.ownerRating : null,
    },
  };
};

const findFullBooking = (id) => Booking.findById(id)
  .populate('loadId')
  .populate('quoteId')
  .populate('shipperId', PERSON_FIELDS)
  .populate('ownerId', PERSON_FIELDS)
  .populate('driverId', PERSON_FIELDS)
  .populate('truckId', TRUCK_FIELDS);

router.get('/:bookingId', async (req, res, next) => {
  try {
    const booking = await findFullBooking(req.params.bookingId);
    if (!booking) return fail(res, 404, 'ADMIN_BOOKING_NOT_FOUND', 'Booking not found');

    const [payments, history] = await Promise.all([
      Payment.find({ bookingId: booking._id }).sort({ createdAt: -1 }).limit(50),
      historyFor('booking', booking._id),
    ]);
    res.json({ success: true, booking: adminBookingView(booking, payments), history });
  } catch (error) {
    next(error);
  }
});

// FLITO stepping in to stop a booking. Like a party cancelling, the truck's
// days and the load's slot are given back; everyone on the booking is told
// why.
router.post('/:bookingId/cancel', async (req, res, next) => {
  try {
    const { reason, error, code, extra } = readReason(req.body, 'people on this booking');
    if (error) return fail(res, 400, code, error, extra);

    const before = await Booking.findById(req.params.bookingId).select('status');
    if (!before) return fail(res, 404, 'ADMIN_BOOKING_NOT_FOUND', 'Booking not found');

    // Atomic, so a delivery reported at the same moment can't be cancelled over.
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.bookingId, status: { $in: ADMIN_CANCELLABLE } },
      { status: 'cancelled' },
      { new: true },
    );
    if (!booking) {
      return fail(res, 400, 'ADMIN_BOOKING_NOT_CANCELLABLE', `A booking that is ${before.status} can't be cancelled`, { status: before.status });
    }

    await releaseBooking(booking, 'cancelled');
    await recordAdminAction(req, {
      action: 'booking.cancelled', targetType: 'booking', targetId: booking._id, reason, meta: { from: before.status },
    });

    const parties = [booking.shipperId, booking.ownerId, booking.driverId].filter(Boolean);
    parties.forEach((id) => req.io?.to(`user-${id}`).emit('booking-status-changed', { booking }));
    await sendPushToUsers(parties, {
      title: 'Booking cancelled by FLITO',
      body: reason,
      data: { type: 'booking', bookingId: String(booking._id) },
    });

    const [full, payments, history] = await Promise.all([
      findFullBooking(booking._id),
      Payment.find({ bookingId: booking._id }).sort({ createdAt: -1 }).limit(50),
      historyFor('booking', booking._id),
    ]);
    res.json({ success: true, booking: adminBookingView(full, payments), history });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
