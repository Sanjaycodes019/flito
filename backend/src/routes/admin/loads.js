const router = require('express').Router();
const Load = require('../../models/Load');
const Quote = require('../../models/Quote');
const Booking = require('../../models/Booking');
const { PARTY_FIELDS, withVerification } = require('../../services/partyView');
const { BIDDABLE_LOAD_STATUSES } = require('../../services/expiry');
const { standingOffer } = require('../../services/negotiation');
const { trucksBookedOf, trucksNeededOf, weightPerTruck } = require('../../services/loadSlots');
const { sendPushToUser } = require('../../services/push');
const { historyFor, recordAdminAction } = require('../../services/audit');
const { closeOpenOffers } = require('../../controllers/quotesController');
const { fail } = require('../../utils/respond');
const {
  paginationParams, paginationMeta, searchClause, enumFilter, idFilter, allOf, readReason, requireObjectId, PERSON_FIELDS, personSummary,
} = require('./helpers');

const STATUSES = ['open', 'quoted', 'negotiating', 'booked', 'completed', 'cancelled', 'expired'];
const TRUCK_FIELDS = 'registrationNumber truckType capacity makeModel verificationStatus';
// Offers shown on a load's page. A load needs at most 10 trucks, so a few
// dozen offers is already far more than any shipper weighs up.
const MAX_OFFERS_SHOWN = 50;

router.param('loadId', requireObjectId('ADMIN_LOAD_NOT_FOUND', 'Load not found'));

// Every load on the platform, newest posted first (unlike the shipper/owner
// marketplace view, this isn't filtered to open or biddable ones).
// Filters: ?q= (goods type), ?status=, ?shipperId=.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = allOf(
      searchClause(req.query, ['goodsType']),
      enumFilter(req.query, 'status', STATUSES),
      idFilter(req.query, 'shipperId'),
    );
    const [loads, total] = await Promise.all([
      Load.find(filter).populate('shipperId', PARTY_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Load.countDocuments(filter),
    ]);
    res.json({
      success: true,
      loads: loads.map((load) => withVerification(load, { people: ['shipperId'] })),
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
});

const truckView = (truck) => (truck?._id ? {
  _id: truck._id,
  registrationNumber: truck.registrationNumber,
  truckType: truck.truckType,
  capacity: truck.capacity,
  makeModel: truck.makeModel,
  verificationStatus: truck.verificationStatus || 'not_submitted',
} : null);

const stopView = (stop) => (stop ? {
  address: stop.address || null,
  label: stop.label || null,
  contactPerson: stop.contactPerson || null,
  phone: stop.phone || null,
  coordinates: stop.coordinates?.lat != null ? stop.coordinates : null,
} : null);

// One load in full: the cargo and route, its shipper, every offer made on it
// and the bookings it became.
const adminLoadView = (load, quotes, bookings) => ({
  _id: load._id,
  goodsType: load.goodsType,
  description: load.description,
  weight: load.weight,
  weightPerTruck: weightPerTruck(load),
  trucksNeeded: trucksNeededOf(load),
  trucksBooked: trucksBookedOf(load),
  truckTypePreference: load.truckTypePreference,
  budgetEstimate: load.budgetEstimate,
  status: load.status,
  pickupDay: load.pickupDay,
  distanceKm: load.distanceKm,
  distanceSource: load.distanceSource,
  tripDays: load.tripDays,
  expiresAt: load.expiresAt,
  totalQuotes: load.totalQuotes || 0,
  photos: (load.photos || []).map(({ _id, url }) => ({ _id, url })),
  pickup: stopView(load.pickupLocation),
  dropoff: stopView(load.dropoffLocation),
  createdAt: load.createdAt,
  updatedAt: load.updatedAt,
  shipper: personSummary(load.shipperId),
  offers: quotes.map((quote) => ({
    _id: quote._id,
    status: quote.status,
    openedBy: quote.initiatedBy || 'owner',
    price: standingOffer(quote).price,
    owner: personSummary(quote.ownerId),
    truck: truckView(quote.truckId),
    createdAt: quote.createdAt,
  })),
  bookings: bookings.map((booking) => ({
    _id: booking._id,
    status: booking.status,
    totalAmount: booking.totalAmount,
    owner: personSummary(booking.ownerId),
    truck: truckView(booking.truckId),
    createdAt: booking.createdAt,
  })),
});

const loadInFull = async (id) => {
  const load = await Load.findById(id).populate('shipperId', PERSON_FIELDS);
  if (!load) return null;
  const [quotes, bookings, history] = await Promise.all([
    Quote.find({ loadId: load._id })
      .populate('ownerId', PERSON_FIELDS)
      .populate('truckId', TRUCK_FIELDS)
      .sort({ createdAt: -1 })
      .limit(MAX_OFFERS_SHOWN),
    Booking.find({ loadId: load._id }).populate('ownerId', PERSON_FIELDS).populate('truckId', TRUCK_FIELDS).sort({ createdAt: 1 }),
    historyFor('load', load._id),
  ]);
  return { load: adminLoadView(load, quotes, bookings), history };
};

router.get('/:loadId', async (req, res, next) => {
  try {
    const full = await loadInFull(req.params.loadId);
    if (!full) return fail(res, 404, 'ADMIN_LOAD_NOT_FOUND', 'Load not found');
    res.json({ success: true, ...full });
  } catch (error) {
    next(error);
  }
});

// Takes a load off the market, e.g. one breaking the rules. Only before any
// truck is booked on it: a booked truck is cancelled from its booking's page.
// The shipper is told why, and owners with open offers that it has closed.
router.post('/:loadId/cancel', async (req, res, next) => {
  try {
    const { reason, error, code, extra } = readReason(req.body, 'shipper');
    if (error) return fail(res, 400, code, error, extra);

    const before = await Load.findById(req.params.loadId).select('status trucksBooked shipperId goodsType');
    if (!before) return fail(res, 404, 'ADMIN_LOAD_NOT_FOUND', 'Load not found');
    if (trucksBookedOf(before) > 0) {
      return fail(res, 400, 'ADMIN_LOAD_HAS_BOOKINGS', 'Trucks are already booked for this load. Cancel those bookings first.');
    }

    const load = await Load.findOneAndUpdate(
      { _id: before._id, status: { $in: [...BIDDABLE_LOAD_STATUSES, 'expired'] }, trucksBooked: { $in: [0, null] } },
      { status: 'cancelled' },
      { new: true },
    );
    if (!load) {
      return fail(res, 400, 'ADMIN_LOAD_NOT_CANCELLABLE', `A load that is ${before.status} can't be cancelled`, { status: before.status });
    }

    await closeOpenOffers(req, load, 'Load no longer available', `${load.goodsType} was taken off FLITO`);
    await recordAdminAction(req, {
      action: 'load.cancelled', targetType: 'load', targetId: load._id, reason, meta: { from: before.status },
    });
    await sendPushToUser(load.shipperId, {
      title: 'Load removed by FLITO',
      body: `${load.goodsType}: ${reason}`,
      data: { type: 'load', loadId: String(load._id) },
    });

    res.json({ success: true, ...(await loadInFull(load._id)) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
