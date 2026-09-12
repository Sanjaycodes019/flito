const Load = require('../models/Load');
const Quote = require('../models/Quote');
const Booking = require('../models/Booking');

// Owner submits a quote on an open load
exports.createQuote = async (req, res, next) => {
  try {
    const { loadId, quotedPrice, perKmRate, baseCharge, taxes, truckType, truckCapacity, estimatedDuration } = req.body;

    const load = await Load.findById(loadId);
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    if (!['open', 'quoted', 'negotiating'].includes(load.status)) {
      return res.status(400).json({ success: false, message: `Load is ${load.status}, no longer accepting quotes` });
    }

    const quote = await Quote.create({
      loadId,
      ownerId: req.user.userId,
      quotedPrice,
      perKmRate,
      baseCharge,
      taxes,
      truckType,
      truckCapacity,
      estimatedDuration,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
    });

    load.status = 'quoted';
    load.totalQuotes += 1;
    await load.save();

    const populated = await quote.populate('ownerId', 'firstName lastName companyName rating');

    // Real-time notify the shipper
    req.io?.to(`user-${load.shipperId}`).emit('new-quote', { load, quote: populated });

    res.status(201).json({ success: true, quote: populated });
  } catch (error) {
    next(error);
  }
};

// Owner's own submitted quotes
exports.listMyQuotes = async (req, res, next) => {
  try {
    const quotes = await Quote.find({ ownerId: req.user.userId })
      .populate('loadId')
      .sort({ createdAt: -1 });
    res.json({ success: true, quotes });
  } catch (error) {
    next(error);
  }
};

// Shipper or owner proposes a counter-offer
exports.counterQuote = async (req, res, next) => {
  try {
    const { counterOfferPrice } = req.body;
    const quote = await Quote.findById(req.params.id).populate('loadId');
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

    const load = quote.loadId;
    const isShipper = String(load.shipperId) === req.user.userId;
    const isOwner = String(quote.ownerId) === req.user.userId;
    if (!isShipper && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not part of this negotiation' });
    }

    quote.status = 'countered';
    quote.counterOfferPrice = counterOfferPrice;
    quote.counterOfferBy = isShipper ? 'shipper' : 'owner';
    quote.counterOfferedAt = new Date();
    await quote.save();

    load.status = 'negotiating';
    await load.save();

    const notifyRoom = isShipper ? `user-${quote.ownerId}` : `user-${load.shipperId}`;
    req.io?.to(notifyRoom).emit('quote-updated', { quote });

    res.json({ success: true, quote });
  } catch (error) {
    next(error);
  }
};

// Shipper accepts a quote -> creates a Booking
exports.acceptQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id).populate('loadId');
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

    const load = quote.loadId;
    if (String(load.shipperId) !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Only the shipper can accept a quote' });
    }

    const finalPrice = quote.counterOfferPrice ?? quote.quotedPrice;

    quote.status = 'accepted';
    quote.acceptedAt = new Date();
    quote.acceptedBy = 'shipper';
    await quote.save();

    load.status = 'booked';
    await load.save();

    const booking = await Booking.create({
      loadId: load._id,
      quoteId: quote._id,
      shipperId: load.shipperId,
      ownerId: quote.ownerId,
      totalAmount: finalPrice,
      amountPending: finalPrice,
    });

    req.io?.to(`user-${quote.ownerId}`).emit('quote-accepted', { quote, booking });

    res.json({ success: true, quote, booking });
  } catch (error) {
    next(error);
  }
};

// Either party rejects a quote
exports.rejectQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id).populate('loadId');
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

    const load = quote.loadId;
    const isShipper = String(load.shipperId) === req.user.userId;
    const isOwner = String(quote.ownerId) === req.user.userId;
    if (!isShipper && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not part of this negotiation' });
    }

    quote.status = 'rejected';
    await quote.save();

    const notifyRoom = isShipper ? `user-${quote.ownerId}` : `user-${load.shipperId}`;
    req.io?.to(notifyRoom).emit('quote-updated', { quote });

    res.json({ success: true, quote });
  } catch (error) {
    next(error);
  }
};
