const Load = require('../models/Load');
const Quote = require('../models/Quote');
const Booking = require('../models/Booking');
const {
  QUOTE_TTL_MS,
  BIDDABLE_LOAD_STATUSES,
  OPEN_QUOTE_STATUSES,
  isExpired,
} = require('../services/expiry');

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const CHANGED_UNDERNEATH = 'This quote just changed — refresh and try again';

// Owner submits a quote on a load that is still taking bids
exports.createQuote = async (req, res, next) => {
  try {
    const { loadId, quotedPrice, perKmRate, baseCharge, taxes, truckType, truckCapacity, estimatedDuration } = req.body;

    const load = await Load.findById(loadId);
    if (!load) return fail(res, 404, 'Load not found');
    if (!BIDDABLE_LOAD_STATUSES.includes(load.status)) {
      return fail(res, 400, `Load is ${load.status}, no longer accepting quotes`);
    }
    if (isExpired(load)) return fail(res, 400, 'This load has expired and is no longer accepting quotes');

    // One live offer per owner per load — they negotiate on it rather than
    // stacking new quotes, which would also inflate the load's quote count.
    const existing = await Quote.exists({
      loadId,
      ownerId: req.user.userId,
      status: { $in: OPEN_QUOTE_STATUSES },
    });
    if (existing) return fail(res, 409, 'You already have an active quote on this load');

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
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    });

    // Atomic updates: concurrent quotes from different owners must not lose a
    // count, and a later quote must not pull "negotiating" back to "quoted".
    await Load.updateOne({ _id: load._id }, { $inc: { totalQuotes: 1 } });
    await Load.updateOne({ _id: load._id, status: 'open' }, { status: 'quoted' });
    const updatedLoad = await Load.findById(load._id);

    const populated = await quote.populate('ownerId', 'firstName lastName companyName rating');

    req.io?.to(`user-${load.shipperId}`).emit('new-quote', { load: updatedLoad, quote: populated });

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

// Loads the quote with its load and resolves which side the caller is on.
// Sends the error response and returns null when that fails.
const loadNegotiation = async (req, res) => {
  const quote = await Quote.findById(req.params.id).populate('loadId');
  if (!quote) {
    fail(res, 404, 'Quote not found');
    return null;
  }

  const load = quote.loadId;
  const isShipper = String(load.shipperId) === req.user.userId;
  const isOwner = String(quote.ownerId) === req.user.userId;
  if (!isShipper && !isOwner) {
    fail(res, 403, 'Not part of this negotiation');
    return null;
  }

  return { quote, load, side: isShipper ? 'shipper' : 'owner' };
};

// Shared by accept and counter: the offer must still be live, its load still
// taking bids, and it must be the caller's turn — nobody responds to their own
// standing offer. Returns the sent response when a rule fails.
const rejectIfNotRespondable = (res, { quote, load, side }) => {
  if (!OPEN_QUOTE_STATUSES.includes(quote.status)) return fail(res, 400, `Quote is already ${quote.status}`);
  if (!BIDDABLE_LOAD_STATUSES.includes(load.status)) return fail(res, 400, `This load is ${load.status}`);
  if (isExpired(quote) || isExpired(load)) return fail(res, 400, 'This offer has expired');

  const offerBy = quote.status === 'countered' ? quote.counterOfferBy : 'owner';
  if (offerBy === side) return fail(res, 400, 'Waiting on the other party to respond to your offer');

  return null;
};

// Matches the quote only if nobody has acted on it since it was read, so two
// simultaneous responses can't both apply.
const unchangedSince = (quote) => ({ _id: quote._id, status: quote.status, updatedAt: quote.updatedAt });

// Shipper or owner proposes a counter-offer
exports.counterQuote = async (req, res, next) => {
  try {
    const negotiation = await loadNegotiation(req, res);
    if (!negotiation) return;
    if (rejectIfNotRespondable(res, negotiation)) return;
    const { quote, load, side } = negotiation;

    const updated = await Quote.findOneAndUpdate(
      unchangedSince(quote),
      {
        status: 'countered',
        counterOfferPrice: req.body.counterOfferPrice,
        counterOfferBy: side,
        counterOfferedAt: new Date(),
        // A counter is fresh activity, so the offer gets a full window again.
        expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
      },
      { new: true },
    );
    if (!updated) return fail(res, 409, CHANGED_UNDERNEATH);

    await Load.updateOne({ _id: load._id, status: { $in: ['open', 'quoted'] } }, { status: 'negotiating' });

    const notifyRoom = side === 'shipper' ? `user-${quote.ownerId}` : `user-${load.shipperId}`;
    req.io?.to(notifyRoom).emit('quote-updated', { quote: updated });

    res.json({ success: true, quote: updated });
  } catch (error) {
    next(error);
  }
};

// Accepting closes the negotiation and creates the Booking. Whoever did NOT
// make the standing offer accepts it: the shipper accepts an owner's quote or
// counter, the owner accepts a shipper's counter.
exports.acceptQuote = async (req, res, next) => {
  try {
    const negotiation = await loadNegotiation(req, res);
    if (!negotiation) return;
    if (rejectIfNotRespondable(res, negotiation)) return;
    const { quote, load, side } = negotiation;

    // Claim the load first with a conditional update. It is atomic, so when two
    // acceptances race on the same load exactly one matches and books it.
    const claimed = await Load.findOneAndUpdate(
      { _id: load._id, status: { $in: BIDDABLE_LOAD_STATUSES } },
      { status: 'booked' },
      { new: true },
    );
    if (!claimed) return fail(res, 400, 'This load has already been booked');

    const accepted = await Quote.findOneAndUpdate(
      unchangedSince(quote),
      { status: 'accepted', acceptedAt: new Date(), acceptedBy: side },
      { new: true },
    );
    if (!accepted) {
      // The quote was countered or rejected mid-request: release the load.
      await Load.updateOne({ _id: load._id, status: 'booked' }, { status: load.status });
      return fail(res, 409, CHANGED_UNDERNEATH);
    }

    const finalPrice = accepted.counterOfferPrice ?? accepted.quotedPrice;

    const booking = await Booking.create({
      loadId: load._id,
      quoteId: accepted._id,
      shipperId: load.shipperId,
      ownerId: accepted.ownerId,
      totalAmount: finalPrice,
      amountPending: finalPrice,
    });

    // The load is taken, so every competing live bid on it is closed out.
    const losing = await Quote.find({
      loadId: load._id,
      _id: { $ne: accepted._id },
      status: { $in: OPEN_QUOTE_STATUSES },
    }).select('ownerId');

    if (losing.length) {
      await Quote.updateMany({ _id: { $in: losing.map((q) => q._id) } }, { status: 'rejected' });
      losing.forEach((q) => req.io?.to(`user-${q.ownerId}`)
        .emit('quote-updated', { quote: { _id: q._id, loadId: load._id, status: 'rejected' } }));
    }

    req.io?.to(`user-${side === 'shipper' ? accepted.ownerId : load.shipperId}`)
      .emit('quote-accepted', { quote: accepted, booking });

    res.json({ success: true, quote: accepted, booking });
  } catch (error) {
    next(error);
  }
};

// Either party walks away from a live quote, whoever's turn it is
exports.rejectQuote = async (req, res, next) => {
  try {
    const negotiation = await loadNegotiation(req, res);
    if (!negotiation) return;
    const { quote, load, side } = negotiation;

    if (!OPEN_QUOTE_STATUSES.includes(quote.status)) {
      return fail(res, 400, `Quote is already ${quote.status}`);
    }

    const rejected = await Quote.findOneAndUpdate(
      { _id: quote._id, status: { $in: OPEN_QUOTE_STATUSES } },
      { status: 'rejected' },
      { new: true },
    );
    if (!rejected) return fail(res, 409, CHANGED_UNDERNEATH);

    // With no live bids left the load is simply open again.
    const stillLive = await Quote.exists({ loadId: load._id, status: { $in: OPEN_QUOTE_STATUSES } });
    if (!stillLive) {
      await Load.updateOne({ _id: load._id, status: { $in: ['quoted', 'negotiating'] } }, { status: 'open' });
    }

    const notifyRoom = side === 'shipper' ? `user-${quote.ownerId}` : `user-${load.shipperId}`;
    req.io?.to(notifyRoom).emit('quote-updated', { quote: rejected });

    res.json({ success: true, quote: rejected });
  } catch (error) {
    next(error);
  }
};
