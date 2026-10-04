const router = require('express').Router();
const Truck = require('../../models/Truck');
const Booking = require('../../models/Booking');
const { truckReviewView, verificationStatusOf, missingTruckDocuments } = require('../../services/truckView');
const { documentView } = require('../../services/kycView');
const { describeArea } = require('../../services/nepalLocations');
const { nepalDay } = require('../../services/nepalTime');
const { sendPushToUser } = require('../../services/push');
const { historyFor, recordAdminAction } = require('../../services/audit');
const { fail } = require('../../utils/respond');
const {
  paginationParams, paginationMeta, searchClause, enumFilter, idFilter, allOf, readDecision, readReason, requireObjectId, fullName,
  PERSON_FIELDS, personSummary,
} = require('./helpers');

const VERIFICATION_STATUSES = ['not_submitted', 'pending', 'approved', 'rejected'];
const OWNER_FIELDS = 'firstName lastName companyName phone email kycStatus';
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'in_transit'];

router.param('truckId', requireObjectId('ADMIN_TRUCK_NOT_FOUND', 'Truck not found'));

const listTrucks = (forcedFilter) => async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = allOf(
      forcedFilter,
      searchClause(req.query, ['registrationNumber', 'makeModel']),
      // Older trucks have no verificationStatus at all; they count as not submitted.
      req.query.status === 'not_submitted'
        ? { $or: [{ verificationStatus: 'not_submitted' }, { verificationStatus: { $exists: false } }] }
        : enumFilter(req.query, 'status', VERIFICATION_STATUSES, 'verificationStatus'),
      idFilter(req.query, 'ownerId'),
      idFilter(req.query, 'driverId', 'assignedDriverId'),
    );
    const [trucks, total] = await Promise.all([
      Truck.find(filter)
        .populate('ownerId', OWNER_FIELDS)
        .sort({ verificationSubmittedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Truck.countDocuments(filter),
    ]);
    res.json({ success: true, trucks: trucks.map(truckReviewView), pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    next(error);
  }
};

// Every truck, with its owner and fresh paper links. Filters: ?q=
// (registration, make/model), ?status= (verification status), ?ownerId=,
// ?driverId= (trucks a driver is assigned to).
router.get('/', listTrucks(null));
// The original review queue URL, kept so nothing that already calls it breaks.
router.get('/pending', listTrucks({ verificationStatus: 'pending' }));

// One truck in full, as an admin checks it: what it is, its papers and when
// they run out, where it works and for how much, who owns and drives it, and
// the days it is booked from today on.
const adminTruckView = (truck) => {
  const status = verificationStatusOf(truck);
  const today = nepalDay();
  return {
    _id: truck._id,
    registrationNumber: truck.registrationNumber,
    truckType: truck.truckType,
    bodyType: truck.bodyType,
    capacity: truck.capacity,
    make: truck.make,
    model: truck.model,
    makeModel: truck.makeModel,
    year: truck.year,
    fuelType: truck.fuelType,
    cargoBed: truck.cargoBed?.lengthFt ? truck.cargoBed : null,
    features: truck.features || {},
    status: truck.status || 'active',
    base: describeArea(truck.baseLocation),
    serviceArea: truck.serviceArea || 'nepal',
    ratePerKm: truck.ratePerKm,
    minimumCharge: truck.minimumCharge,
    chassisNumber: truck.chassisNumber,
    engineNumber: truck.engineNumber,
    bluebookRenewedUntil: truck.bluebookRenewedUntil,
    insurance: truck.insurance?.validUntil || truck.insurance?.company ? truck.insurance : null,
    emissionTestValidUntil: truck.emissionTestValidUntil,
    bookedDays: [...(truck.reservedDays || [])].filter((day) => day >= today).sort(),
    owner: personSummary(truck.ownerId),
    driver: personSummary(truck.assignedDriverId),
    createdAt: truck.createdAt,
    updatedAt: truck.updatedAt,
    verification: {
      status,
      rejectionReason: status === 'rejected' ? truck.verificationRejectionReason : undefined,
      submittedAt: truck.verificationSubmittedAt,
      reviewedAt: truck.verificationReviewedAt,
      reviewedBy: truck.verificationReviewedBy?._id
        ? { _id: truck.verificationReviewedBy._id, name: fullName(truck.verificationReviewedBy) || truck.verificationReviewedBy.email }
        : null,
      missingDocuments: missingTruckDocuments(truck),
      documents: (truck.verificationDocuments || []).map(documentView),
    },
  };
};

router.get('/:truckId', async (req, res, next) => {
  try {
    const truck = await Truck.findById(req.params.truckId)
      .populate('ownerId', PERSON_FIELDS)
      .populate('assignedDriverId', PERSON_FIELDS)
      .populate('verificationReviewedBy', 'firstName lastName email');
    if (!truck) return fail(res, 404, 'ADMIN_TRUCK_NOT_FOUND', 'Truck not found');

    const [bookings, activeBookings, completedBookings, history] = await Promise.all([
      Booking.countDocuments({ truckId: truck._id }),
      Booking.countDocuments({ truckId: truck._id, status: { $in: ACTIVE_BOOKING_STATUSES } }),
      Booking.countDocuments({ truckId: truck._id, status: 'completed' }),
      historyFor('truck', truck._id),
    ]);
    res.json({ success: true, truck: adminTruckView(truck), counts: { bookings, activeBookings, completedBookings }, history });
  } catch (error) {
    next(error);
  }
});

// Tells the owner how their truck's verification now stands.
const announce = async (req, truck, { revoked = false } = {}) => {
  req.io?.to(`user-${truck.ownerId}`).emit('truck-reviewed', {
    truckId: truck._id,
    status: truck.verificationStatus,
    reason: truck.verificationRejectionReason,
  });
  await sendPushToUser(truck.ownerId, truck.verificationStatus === 'approved'
    ? { title: 'Truck verified', body: `${truck.registrationNumber} now shows the verified badge`, data: { type: 'fleet' } }
    : {
      title: revoked ? 'Truck verification removed' : 'Truck verification needs changes',
      body: `${truck.registrationNumber}: ${truck.verificationRejectionReason}`,
      data: { type: 'fleet' },
    });
};

const decisionView = (truck) => ({
  _id: truck._id,
  verificationStatus: truck.verificationStatus,
  verificationRejectionReason: truck.verificationRejectionReason,
});

const refuseMissing = async (res, truckId, code, message) => (
  (await Truck.exists({ _id: truckId }))
    ? fail(res, 400, code, message)
    : fail(res, 404, 'ADMIN_TRUCK_NOT_FOUND', 'Truck not found')
);

router.patch('/:truckId', async (req, res, next) => {
  try {
    const { decision, reason, error, code, extra } = readDecision(req.body, 'owner');
    if (error) return fail(res, 400, code, error, extra);

    const reviewed = { verificationReviewedAt: new Date(), verificationReviewedBy: req.user.userId };
    const update = decision === 'approved'
      ? { $set: { verificationStatus: 'approved', ...reviewed }, $unset: { verificationRejectionReason: '' } }
      : { $set: { verificationStatus: 'rejected', verificationRejectionReason: reason, ...reviewed } };

    // Only a truck awaiting review can be decided.
    const truck = await Truck.findOneAndUpdate({ _id: req.params.truckId, verificationStatus: 'pending' }, update, { new: true });
    if (!truck) return refuseMissing(res, req.params.truckId, 'ADMIN_TRUCK_NOT_PENDING', 'This truck has no verification awaiting review');

    await recordAdminAction(req, { action: `truck.${decision}`, targetType: 'truck', targetId: truck._id, reason });
    await announce(req, truck);

    res.json({ success: true, truck: decisionView(truck) });
  } catch (error) {
    next(error);
  }
});

// Takes a truck's verification back, e.g. when its papers turn out to be
// expired or not its own. The owner is told why and can send them again;
// until then the truck shows no verified badge.
router.post('/:truckId/revoke', async (req, res, next) => {
  try {
    const { reason, error, code, extra } = readReason(req.body, 'owner');
    if (error) return fail(res, 400, code, error, extra);

    const truck = await Truck.findOneAndUpdate(
      { _id: req.params.truckId, verificationStatus: 'approved' },
      {
        $set: {
          verificationStatus: 'rejected', verificationRejectionReason: reason, verificationReviewedAt: new Date(), verificationReviewedBy: req.user.userId,
        },
      },
      { new: true },
    );
    if (!truck) return refuseMissing(res, req.params.truckId, 'ADMIN_TRUCK_NOT_APPROVED', 'This truck is not verified');

    await recordAdminAction(req, { action: 'truck.revoked', targetType: 'truck', targetId: truck._id, reason });
    await announce(req, truck, { revoked: true });

    res.json({ success: true, truck: decisionView(truck) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
