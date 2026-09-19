const router = require('express').Router();
const Truck = require('../../models/Truck');
const { truckReviewView } = require('../../services/truckView');
const { sendPushToUser } = require('../../services/push');
const { fail } = require('../../utils/respond');
const { paginationParams, paginationMeta, searchClause, enumFilter, allOf, readDecision } = require('./helpers');

const VERIFICATION_STATUSES = ['not_submitted', 'pending', 'approved', 'rejected'];
const OWNER_FIELDS = 'firstName lastName companyName phone email kycStatus';

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
// (registration, make/model), ?status= (verification status).
router.get('/', listTrucks(null));
// The original review queue URL, kept so nothing that already calls it breaks.
router.get('/pending', listTrucks({ verificationStatus: 'pending' }));

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

    if (!truck) {
      const exists = await Truck.exists({ _id: req.params.truckId });
      return exists
        ? fail(res, 400, 'ADMIN_TRUCK_NOT_PENDING', 'This truck has no verification awaiting review')
        : fail(res, 404, 'ADMIN_TRUCK_NOT_FOUND', 'Truck not found');
    }

    req.io?.to(`user-${truck.ownerId}`).emit('truck-reviewed', {
      truckId: truck._id,
      status: truck.verificationStatus,
      reason: truck.verificationRejectionReason,
    });
    await sendPushToUser(truck.ownerId, truck.verificationStatus === 'approved'
      ? { title: 'Truck verified', body: `${truck.registrationNumber} now shows the verified badge`, data: { type: 'fleet' } }
      : { title: 'Truck verification needs changes', body: `${truck.registrationNumber}: ${truck.verificationRejectionReason}`, data: { type: 'fleet' } });

    res.json({
      success: true,
      truck: { _id: truck._id, verificationStatus: truck.verificationStatus, verificationRejectionReason: truck.verificationRejectionReason },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
