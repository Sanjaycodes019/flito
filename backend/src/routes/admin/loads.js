const router = require('express').Router();
const Load = require('../../models/Load');
const { PARTY_FIELDS, withVerification } = require('../../services/partyView');
const { paginationParams, paginationMeta, searchClause, enumFilter, allOf } = require('./helpers');

const STATUSES = ['open', 'quoted', 'negotiating', 'booked', 'completed', 'cancelled', 'expired'];

// Every load on the platform, newest posted first (unlike the shipper/owner
// marketplace view, this isn't filtered to open or biddable ones).
// Filters: ?q= (goods type), ?status=.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const filter = allOf(searchClause(req.query, ['goodsType']), enumFilter(req.query, 'status', STATUSES));
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

module.exports = router;
