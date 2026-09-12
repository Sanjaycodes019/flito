const Load = require('../models/Load');
const Quote = require('../models/Quote');

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
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    res.status(201).json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// List open loads (for owners to browse), or the requesting shipper's own loads
exports.listLoads = async (req, res, next) => {
  try {
    const { mine, status } = req.query;
    const filter = {};

    if (mine === 'true') {
      filter.shipperId = req.user.userId;
    } else {
      filter.status = status || 'open';
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

// Shipper cancels their own open load
exports.cancelLoad = async (req, res, next) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    if (String(load.shipperId) !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not your load' });
    }
    if (!['open', 'quoted', 'negotiating'].includes(load.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a load that is ${load.status}` });
    }

    load.status = 'cancelled';
    await load.save();
    res.json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// All quotes submitted for one load (shipper reviewing bids)
exports.listQuotesForLoad = async (req, res, next) => {
  try {
    const load = await Load.findById(req.params.id);
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    if (String(load.shipperId) !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not your load' });
    }

    const quotes = await Quote.find({ loadId: load._id })
      .populate('ownerId', 'firstName lastName companyName rating')
      .sort({ createdAt: -1 });

    res.json({ success: true, quotes });
  } catch (error) {
    next(error);
  }
};
