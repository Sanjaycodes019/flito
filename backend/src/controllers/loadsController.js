const Load = require('../models/Load');
const Quote = require('../models/Quote');
const {
  LOAD_TTL_MS,
  BIDDABLE_LOAD_STATUSES,
  OPEN_QUOTE_STATUSES,
  isExpired,
} = require('../services/expiry');

// Create a load posting (Shipper only)
exports.createLoad = async (req, res, next) => {
  try {
    const {
      goodsType, description, weight, volume, quantity,
      pickupLocation, dropoffLocation, preferredPickupDate,
      estimatedDeliveryDate, truckTypePreference, budgetEstimate, photos,
    } = req.body;

    const load = await Load.create({
      shipperId: req.user.userId,
      goodsType,
      description,
      weight,
      volume,
      quantity,
      pickupLocation,
      dropoffLocation,
      preferredPickupDate,
      estimatedDeliveryDate,
      truckTypePreference,
      budgetEstimate,
      photos,
      expiresAt: new Date(Date.now() + LOAD_TTL_MS),
    });

    res.status(201).json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// A shipper sees all of their own loads. Everyone else browses loads that are
// still taking bids — including ones that already have quotes, so several
// owners can compete — minus any whose window has closed.
exports.listLoads = async (req, res, next) => {
  try {
    const { mine, status } = req.query;
    const filter = {};

    if (mine === 'true') {
      filter.shipperId = req.user.userId;
    } else if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: BIDDABLE_LOAD_STATUSES };
      filter.$or = [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }];
    }

    const loads = await Load.find(filter)
      .populate('shipperId', 'firstName lastName rating companyName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, loads });
  } catch (error) {
    next(error);
  }
};

exports.getLoad = async (req, res, next) => {
  try {
    const load = await Load.findById(req.params.id).populate('shipperId', 'firstName lastName rating companyName');
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    res.json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

const findOwnLoad = async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) {
    res.status(404).json({ success: false, message: 'Load not found' });
    return null;
  }
  if (String(load.shipperId) !== req.user.userId) {
    res.status(403).json({ success: false, message: 'Not your load' });
    return null;
  }
  return load;
};

// Shipper withdraws their own load before it is booked. Live bids on it are
// closed out so owners aren't left negotiating on a load that no longer exists.
exports.cancelLoad = async (req, res, next) => {
  try {
    const load = await findOwnLoad(req, res);
    if (!load) return;

    if (![...BIDDABLE_LOAD_STATUSES, 'expired'].includes(load.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a load that is ${load.status}` });
    }

    load.status = 'cancelled';
    await load.save();
    await Quote.updateMany({ loadId: load._id, status: { $in: OPEN_QUOTE_STATUSES } }, { status: 'rejected' });

    res.json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// Put an expired load back on the market with a fresh window. Bids made on the
// old posting stay expired; owners bid again against the relisted load.
exports.relistLoad = async (req, res, next) => {
  try {
    const load = await findOwnLoad(req, res);
    if (!load) return;

    // The sweep may not have run yet, so a biddable load past its window
    // counts as expired too.
    const lapsed = load.status === 'expired'
      || (BIDDABLE_LOAD_STATUSES.includes(load.status) && isExpired(load));
    if (!lapsed) {
      return res.status(400).json({ success: false, message: `Only an expired load can be relisted (this one is ${load.status})` });
    }

    await Quote.updateMany({ loadId: load._id, status: { $in: OPEN_QUOTE_STATUSES } }, { status: 'expired' });

    load.status = 'open';
    load.totalQuotes = 0;
    load.expiresAt = new Date(Date.now() + LOAD_TTL_MS);
    await load.save();

    res.json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// All quotes submitted for one load (shipper reviewing bids)
exports.listQuotesForLoad = async (req, res, next) => {
  try {
    const load = await findOwnLoad(req, res);
    if (!load) return;

    const quotes = await Quote.find({ loadId: load._id })
      .populate('ownerId', 'firstName lastName companyName rating')
      .sort({ createdAt: -1 });

    res.json({ success: true, quotes });
  } catch (error) {
    next(error);
  }
};
