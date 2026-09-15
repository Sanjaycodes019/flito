const Load = require('../models/Load');
const Quote = require('../models/Quote');
const Booking = require('../models/Booking');
const Truck = require('../models/Truck');
const User = require('../models/User');
const { sendPushToUser, sendPushToUsers } = require('../services/push');
const {
  BIDDABLE_LOAD_STATUSES,
  OPEN_QUOTE_STATUSES,
  isExpired,
  offerExpiresAt,
} = require('../services/expiry');
const { capacityOf, driverIsReady, unavailableReason } = require('../services/truckMatching');
const {
  MAX_OPEN_REQUESTS_PER_LOAD,
  counterProblem,
  offerHistory,
  standingOffer,
} = require('../services/negotiation');
const { requiresVerification } = require('../services/kycPolicy');
const { PARTY_FIELDS, withVerification } = require('../services/partyView');
const { formatCurrency } = require('../utils/format');

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const CHANGED_UNDERNEATH = 'This offer just changed. Refresh and try again.';

// Registration numbers stay private until a booking is made.
const TRUCK_FIELDS = 'truckType capacity makeModel baseLocation verificationStatus';

const displayName = (user) => user?.companyName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'A truck owner';

const withDetails = (query) => query.populate('ownerId', PARTY_FIELDS).populate('truckId', TRUCK_FIELDS);

// A populated quote as the other party sees it, with who and what is verified.
const quoteView = (quote) => withVerification(quote, { people: ['ownerId'], trucks: ['truckId'] });

// A new offer counts toward the load's offers and moves an untouched load to
// "quoted". Both updates are atomic, so offers landing together can't lose a
// count, and a later offer can't pull "negotiating" back to "quoted".
const recordNewOffer = async (load) => {
  await Load.updateOne({ _id: load._id }, { $inc: { totalQuotes: 1 } });
  await Load.updateOne({ _id: load._id, status: 'open' }, { status: 'quoted' });
};

// Sends the error and returns true when the load can't take offers.
const refuseIfLoadClosed = (res, load) => {
  if (!BIDDABLE_LOAD_STATUSES.includes(load.status)) {
    fail(res, 400, `Load is ${load.status}, no longer accepting offers`);
    return true;
  }
  if (isExpired(load)) {
    fail(res, 400, 'This load has expired and is no longer accepting offers');
    return true;
  }
  return false;
};

// An owner quotes on a load with one of their own trucks that can carry it.
exports.createQuote = async (req, res, next) => {
  try {
    const { loadId, quotedPrice, truckId, estimatedDuration } = req.body;

    const load = await Load.findById(loadId);
    if (!load) return fail(res, 404, 'Load not found');
    if (refuseIfLoadClosed(res, load)) return;

    const truck = await Truck.findOne({ _id: truckId, ownerId: req.user.userId });
    if (!truck) return fail(res, 404, 'That truck is not in your fleet');
    const problem = unavailableReason(truck, load);
    if (problem) return fail(res, 400, problem);

    // One live negotiation per owner per load. They negotiate on it rather
    // than stacking new offers.
    const existing = await Quote.exists({
      loadId,
      ownerId: req.user.userId,
      status: { $in: OPEN_QUOTE_STATUSES },
    });
    if (existing) return fail(res, 409, 'You already have an active offer on this load');

    const quote = await Quote.create({
      loadId,
      ownerId: req.user.userId,
      truckId: truck._id,
      truckType: truck.truckType,
      truckCapacity: capacityOf(truck),
      initiatedBy: 'owner',
      quotedPrice,
      offers: [{ by: 'owner', price: quotedPrice }],
      estimatedDuration,
      expiresAt: offerExpiresAt(load),
    });
    await recordNewOffer(load);

    const [updatedLoad, populated] = await Promise.all([
      Load.findById(load._id),
      withDetails(Quote.findById(quote._id)),
    ]);

    req.io?.to(`user-${load.shipperId}`).emit('new-quote', { load: updatedLoad, quote: quoteView(populated) });
    await sendPushToUser(load.shipperId, {
      title: 'New quote received',
      body: `${displayName(populated.ownerId)} quoted ${formatCurrency(quotedPrice)} on your ${load.goodsType} load`,
      data: { type: 'load', loadId: String(load._id) },
    });

    res.status(201).json({ success: true, quote: quoteView(populated) });
  } catch (error) {
    next(error);
  }
};

// A shipper asks the owner of a matched truck to carry their load at a price.
// The owner can accept (which books it), counter or decline.
exports.requestTruck = async (req, res, next) => {
  try {
    const { truckId, price } = req.body;

    const load = await Load.findById(req.params.id);
    if (!load) return fail(res, 404, 'Load not found');
    if (String(load.shipperId) !== req.user.userId) return fail(res, 403, 'Not your load');
    if (refuseIfLoadClosed(res, load)) return;

    const truck = await Truck.findById(truckId).populate('ownerId', 'firstName lastName companyName kycStatus status');
    const owner = truck?.ownerId;
    if (!truck || !owner) return fail(res, 404, 'Truck not found');
    if (owner.status !== 'active' || (requiresVerification('makeOffer', 'owner') && owner.kycStatus !== 'approved')) {
      return fail(res, 400, "This truck's owner can't take bookings right now");
    }
    const problem = unavailableReason(truck, load);
    if (problem) return fail(res, 400, problem);

    const [existing, waiting] = await Promise.all([
      Quote.exists({ loadId: load._id, ownerId: owner._id, status: { $in: OPEN_QUOTE_STATUSES } }),
      Quote.countDocuments({ loadId: load._id, initiatedBy: 'shipper', status: { $in: OPEN_QUOTE_STATUSES } }),
    ]);
    if (existing) {
      return fail(res, 409, `You already have an open offer with ${displayName(owner)} on this load. Reply to it instead.`);
    }
    if (waiting >= MAX_OPEN_REQUESTS_PER_LOAD) {
      return fail(res, 409, `You can have ${MAX_OPEN_REQUESTS_PER_LOAD} requests waiting at once. Wait for a reply, or withdraw one first.`);
    }

    const quote = await Quote.create({
      loadId: load._id,
      ownerId: owner._id,
      truckId: truck._id,
      truckType: truck.truckType,
      truckCapacity: capacityOf(truck),
      initiatedBy: 'shipper',
      quotedPrice: price,
      offers: [{ by: 'shipper', price }],
      expiresAt: offerExpiresAt(load),
    });
    await recordNewOffer(load);
    const populated = await withDetails(Quote.findById(quote._id));

    req.io?.to(`user-${owner._id}`).emit('quote-updated', { quote: quoteView(populated) });
    await sendPushToUser(owner._id, {
      title: 'New booking request',
      body: `A shipper offers ${formatCurrency(price)} for your ${truck.truckType} truck to carry ${load.goodsType}`,
      data: { type: 'load', loadId: String(load._id) },
    });

    res.status(201).json({ success: true, quote: quoteView(populated) });
  } catch (error) {
    next(error);
  }
};

// The owner's negotiations, newest first.
exports.listMyQuotes = async (req, res, next) => {
  try {
    const quotes = await Quote.find({ ownerId: req.user.userId })
      .populate('loadId')
      .populate('truckId', `registrationNumber ${TRUCK_FIELDS}`)
      .sort({ createdAt: -1 });
    res.json({ success: true, quotes: quotes.map((quote) => withVerification(quote, { trucks: ['truckId'] })) });
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
// taking offers, and it must be the caller's turn. Nobody responds to their own
// standing offer. Returns the sent response when a rule fails.
const refuseIfNotRespondable = (res, { quote, load, side }) => {
  if (!OPEN_QUOTE_STATUSES.includes(quote.status)) return fail(res, 400, `Quote is already ${quote.status}`);
  if (!BIDDABLE_LOAD_STATUSES.includes(load.status)) return fail(res, 400, `This load is ${load.status}`);
  if (isExpired(quote) || isExpired(load)) return fail(res, 400, 'This offer has expired');
  if (standingOffer(quote).by === side) return fail(res, 400, 'Waiting on the other party to respond to your offer');
  return null;
};

// Matches the quote only if nobody has acted on it since it was read, so two
// simultaneous responses can't both apply.
const unchangedSince = (quote) => ({ _id: quote._id, status: quote.status, updatedAt: quote.updatedAt });

// Shipper or owner makes a counter-offer, within the negotiation rules.
exports.counterQuote = async (req, res, next) => {
  try {
    const negotiation = await loadNegotiation(req, res);
    if (!negotiation) return;
    if (refuseIfNotRespondable(res, negotiation)) return;
    const { quote, load, side } = negotiation;

    const price = req.body.counterOfferPrice;
    const problem = counterProblem(quote, side, price);
    if (problem) return fail(res, 400, problem);

    const now = new Date();
    const updated = await Quote.findOneAndUpdate(
      unchangedSince(quote),
      {
        status: 'countered',
        counterOfferPrice: price,
        counterOfferBy: side,
        counterOfferedAt: now,
        offers: [...offerHistory(quote), { by: side, price, at: now }],
        // A counter is fresh activity, so the offer gets a full window again.
        expiresAt: offerExpiresAt(load),
      },
      { new: true },
    );
    if (!updated) return fail(res, 409, CHANGED_UNDERNEATH);

    await Load.updateOne({ _id: load._id, status: { $in: ['open', 'quoted'] } }, { status: 'negotiating' });

    const notifyUserId = side === 'shipper' ? quote.ownerId : load.shipperId;
    req.io?.to(`user-${notifyUserId}`).emit('quote-updated', { quote: updated });
    await sendPushToUser(notifyUserId, {
      title: 'Counter-offer received',
      body: `New offer of ${formatCurrency(price)} on ${load.goodsType}`,
      data: { type: 'load', loadId: String(load._id) },
    });

    res.json({ success: true, quote: updated });
  } catch (error) {
    next(error);
  }
};

// Accepting closes the negotiation and creates the Booking. Whoever did NOT
// make the standing offer accepts it.
exports.acceptQuote = async (req, res, next) => {
  try {
    const negotiation = await loadNegotiation(req, res);
    if (!negotiation) return;
    if (refuseIfNotRespondable(res, negotiation)) return;
    const { quote, load, side } = negotiation;
    const finalPrice = standingOffer(quote).price;

    // The truck first. Its pickup day is added with a conditional update, so
    // two bookings racing for one truck on the same day can't both get it.
    let truck = null;
    if (quote.truckId) {
      truck = load.pickupDay
        ? await Truck.findOneAndUpdate(
          { _id: quote.truckId, status: 'active', reservedDays: { $ne: load.pickupDay } },
          { $push: { reservedDays: load.pickupDay } },
          { new: true },
        )
        : await Truck.findById(quote.truckId);
      if (!truck) return fail(res, 409, 'That truck is no longer available on the pickup date');
    }
    const releaseTruck = async () => {
      if (truck && load.pickupDay) await Truck.updateOne({ _id: truck._id }, { $pull: { reservedDays: load.pickupDay } });
    };

    // Then the load, claimed atomically: when two acceptances race on the same
    // load exactly one matches and books it.
    const claimed = await Load.findOneAndUpdate(
      { _id: load._id, status: { $in: BIDDABLE_LOAD_STATUSES } },
      { status: 'booked' },
      { new: true },
    );
    if (!claimed) {
      await releaseTruck();
      return fail(res, 400, 'This load has already been booked');
    }

    const accepted = await Quote.findOneAndUpdate(
      unchangedSince(quote),
      { status: 'accepted', acceptedAt: new Date(), acceptedBy: side },
      { new: true },
    );
    if (!accepted) {
      // The quote was countered or rejected mid-request: release everything.
      await Load.updateOne({ _id: load._id, status: 'booked' }, { status: load.status });
      await releaseTruck();
      return fail(res, 409, CHANGED_UNDERNEATH);
    }

    // The truck's regular driver comes with it when they can drive a booking.
    const driver = truck?.assignedDriverId
      ? await User.findOne({ _id: truck.assignedDriverId, role: 'driver' }).select('firstName kycStatus status')
      : null;
    const driverReady = driverIsReady(driver);

    const booking = await Booking.create({
      loadId: load._id,
      quoteId: accepted._id,
      shipperId: load.shipperId,
      ownerId: accepted.ownerId,
      truckId: truck?._id,
      driverId: driverReady ? driver._id : undefined,
      status: driverReady ? 'confirmed' : 'pending',
      totalAmount: finalPrice,
      amountPending: finalPrice,
    });

    // The load is taken, so every other live offer on it is closed out.
    const losing = await Quote.find({
      loadId: load._id,
      _id: { $ne: accepted._id },
      status: { $in: OPEN_QUOTE_STATUSES },
    }).select('ownerId');

    if (losing.length) {
      await Quote.updateMany({ _id: { $in: losing.map((q) => q._id) } }, { status: 'rejected' });
      losing.forEach((q) => req.io?.to(`user-${q.ownerId}`)
        .emit('quote-updated', { quote: { _id: q._id, loadId: load._id, status: 'rejected' } }));
      await sendPushToUsers(losing.map((q) => q.ownerId), {
        title: 'Load no longer available',
        body: `${load.goodsType} was booked with another truck`,
        data: { type: 'load', loadId: String(load._id) },
      });
    }

    const otherPartyId = side === 'shipper' ? accepted.ownerId : load.shipperId;
    req.io?.to(`user-${otherPartyId}`).emit('quote-accepted', { quote: accepted, booking });
    await sendPushToUser(otherPartyId, {
      title: 'Offer accepted!',
      body: `Your ${formatCurrency(finalPrice)} offer on ${load.goodsType} was accepted`,
      data: { type: 'booking', bookingId: String(booking._id) },
    });

    if (driverReady) {
      req.io?.to(`user-${driver._id}`).emit('booking-assigned', { booking });
      await sendPushToUser(driver._id, {
        title: 'New delivery assigned',
        body: `You're driving ${load.goodsType} from ${load.pickupLocation?.label || 'the pickup'} to ${load.dropoffLocation?.label || 'the dropoff'}`,
        data: { type: 'booking', bookingId: String(booking._id) },
      });
    }

    res.json({ success: true, quote: accepted, booking });
  } catch (error) {
    next(error);
  }
};

// Either party walks away from a live offer: declining the other side's offer,
// or withdrawing their own.
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

    // With no live offers left the load is simply open again.
    const stillLive = await Quote.exists({ loadId: load._id, status: { $in: OPEN_QUOTE_STATUSES } });
    if (!stillLive) {
      await Load.updateOne({ _id: load._id, status: { $in: ['quoted', 'negotiating'] } }, { status: 'open' });
    }

    const withdrew = standingOffer(quote).by === side;
    const notifyUserId = side === 'shipper' ? quote.ownerId : load.shipperId;
    req.io?.to(`user-${notifyUserId}`).emit('quote-updated', { quote: rejected });
    await sendPushToUser(notifyUserId, withdrew
      ? { title: 'Offer withdrawn', body: `The ${side} withdrew their offer on ${load.goodsType}`, data: { type: 'load', loadId: String(load._id) } }
      : { title: 'Offer declined', body: `Your offer on ${load.goodsType} was declined`, data: { type: 'load', loadId: String(load._id) } });

    res.json({ success: true, quote: rejected });
  } catch (error) {
    next(error);
  }
};
