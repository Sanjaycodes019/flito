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
const { standingOffer } = require('../services/negotiation');
const {
  HAS_OPEN_SLOT,
  maxOpenRequestsFor,
  openSlotsOf,
  trucksBookedOf,
  trucksNeededOf,
} = require('../services/loadSlots');
const { requiresVerification } = require('../services/kycPolicy');
const { busyDaysOf } = require('../services/tripSchedule');
const { PARTY_FIELDS, withVerification } = require('../services/partyView');
const { formatCurrency } = require('../utils/format');
const { fail } = require('../utils/respond');

const CHANGED_UNDERNEATH = 'This offer just changed. Refresh and try again.';

// Registration numbers stay private until a booking is made.
const TRUCK_FIELDS = 'truckType capacity makeModel baseLocation verificationStatus';

const displayName = (user) => user?.companyName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'A truck owner';

const withDetails = (query) => query.populate('ownerId', PARTY_FIELDS).populate('truckId', TRUCK_FIELDS);

// A populated quote as the other party sees it, with who and what is verified.
const quoteView = (quote) => withVerification(quote, { people: ['ownerId'], trucks: ['truckId'] });

// New offers count toward the load's offers and move an untouched load to
// "quoted". Both updates are atomic, so offers landing together can't lose a
// count.
const recordNewOffers = async (load, count = 1) => {
  await Load.updateOne({ _id: load._id }, { $inc: { totalQuotes: count } });
  await Load.updateOne({ _id: load._id, status: 'open' }, { status: 'quoted' });
};

// Sends the error and returns true when the load can't take offers.
const refuseIfLoadClosed = (res, load) => {
  if (!BIDDABLE_LOAD_STATUSES.includes(load.status)) {
    fail(res, 400, 'QUOTES_LOAD_NOT_ACCEPTING_OFFERS', `Load is ${load.status}, no longer accepting offers`, { status: load.status });
    return true;
  }
  if (isExpired(load)) {
    fail(res, 400, 'QUOTES_LOAD_EXPIRED', 'This load has expired and is no longer accepting offers');
    return true;
  }
  return false;
};

// An owner applies to a load with one or more of their own trucks that can
// carry it, at one price per truck. Each truck becomes its own offer, so the
// shipper can take some of them and not others. An owner can't offer more
// trucks than the load still needs, and each truck only once.
exports.createQuote = async (req, res, next) => {
  try {
    const { loadId, quotedPrice, truckIds, estimatedDuration } = req.body;

    const load = await Load.findById(loadId);
    if (!load) return fail(res, 404, 'QUOTES_LOAD_NOT_FOUND', 'Load not found');
    if (refuseIfLoadClosed(res, load)) return;

    const trucks = await Truck.find({ _id: { $in: truckIds }, ownerId: req.user.userId });
    if (trucks.length !== truckIds.length) return fail(res, 404, 'QUOTES_TRUCK_NOT_IN_FLEET', 'That truck is not in your fleet');
    for (const truck of trucks) {
      const problem = unavailableReason(truck, load);
      if (problem) {
        const detail = trucks.length > 1 ? `${truck.registrationNumber}: ${problem}` : problem;
        return fail(res, 400, 'QUOTES_TRUCK_UNAVAILABLE', detail, { detail });
      }
    }

    const live = await Quote.find({ loadId, ownerId: req.user.userId, status: { $in: OPEN_QUOTE_STATUSES } }).select('truckId');
    const liveTrucks = new Set(live.map((quote) => String(quote.truckId)));
    if (trucks.some((truck) => liveTrucks.has(String(truck._id)))) {
      return fail(res, 409, 'QUOTES_ACTIVE_OFFER_EXISTS', 'You have already offered that truck for this load');
    }
    const slots = openSlotsOf(load);
    if (live.length + trucks.length > slots) {
      return fail(
        res,
        400,
        'QUOTES_MORE_TRUCKS_THAN_NEEDED',
        `This load needs ${slots} more ${slots === 1 ? 'truck' : 'trucks'}, so you can offer up to ${slots} in all.`,
        { slots },
      );
    }

    const quotes = await Quote.insertMany(trucks.map((truck) => ({
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
    })));
    await recordNewOffers(load, quotes.length);

    const [updatedLoad, populated] = await Promise.all([
      Load.findById(load._id),
      withDetails(Quote.find({ _id: { $in: quotes.map((quote) => quote._id) } })),
    ]);
    const views = populated.map(quoteView);

    views.forEach((quote) => req.io?.to(`user-${load.shipperId}`).emit('new-quote', { load: updatedLoad, quote }));
    const owner = displayName(populated[0].ownerId);
    await sendPushToUser(load.shipperId, {
      title: quotes.length > 1 ? `${quotes.length} trucks applied` : 'A truck applied',
      body: quotes.length > 1
        ? `${owner} offers ${quotes.length} trucks at ${formatCurrency(quotedPrice)} each for your ${load.goodsType} load`
        : `${owner} offers a truck at ${formatCurrency(quotedPrice)} for your ${load.goodsType} load`,
      data: { type: 'load', loadId: String(load._id) },
    });

    res.status(201).json({ success: true, quotes: views });
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
    if (!load) return fail(res, 404, 'QUOTES_LOAD_NOT_FOUND', 'Load not found');
    if (String(load.shipperId) !== req.user.userId) return fail(res, 403, 'QUOTES_NOT_YOUR_LOAD', 'Not your load');
    if (refuseIfLoadClosed(res, load)) return;

    const truck = await Truck.findById(truckId).populate('ownerId', 'firstName lastName companyName kycStatus status');
    const owner = truck?.ownerId;
    if (!truck || !owner) return fail(res, 404, 'QUOTES_TRUCK_NOT_FOUND', 'Truck not found');
    if (owner.status !== 'active' || (requiresVerification('makeOffer', 'owner') && owner.kycStatus !== 'approved')) {
      return fail(res, 400, 'QUOTES_OWNER_UNAVAILABLE', "This truck's owner can't take bookings right now");
    }
    const problem = unavailableReason(truck, load);
    if (problem) return fail(res, 400, 'QUOTES_TRUCK_UNAVAILABLE', problem, { detail: problem });

    const [existing, waiting] = await Promise.all([
      Quote.exists({ loadId: load._id, truckId: truck._id, status: { $in: OPEN_QUOTE_STATUSES } }),
      Quote.countDocuments({ loadId: load._id, initiatedBy: 'shipper', status: { $in: OPEN_QUOTE_STATUSES } }),
    ]);
    if (existing) {
      return fail(
        res,
        409,
        'QUOTES_OPEN_OFFER_WITH_OWNER',
        `There is already an open offer for this truck from ${displayName(owner)}. Answer it instead.`,
        { ownerName: displayName(owner) },
      );
    }
    const maxRequests = maxOpenRequestsFor(load);
    if (waiting >= maxRequests) {
      return fail(
        res,
        409,
        'QUOTES_TOO_MANY_OPEN_REQUESTS',
        `You can have ${maxRequests} requests waiting at once. Wait for a reply, or withdraw one first.`,
        { max: maxRequests },
      );
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
    await recordNewOffers(load);
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
    fail(res, 404, 'QUOTES_QUOTE_NOT_FOUND', 'Quote not found');
    return null;
  }

  const load = quote.loadId;
  const isShipper = String(load.shipperId) === req.user.userId;
  const isOwner = String(quote.ownerId) === req.user.userId;
  if (!isShipper && !isOwner) {
    fail(res, 403, 'QUOTES_NOT_PART_OF_NEGOTIATION', 'Not part of this negotiation');
    return null;
  }

  return { quote, load, side: isShipper ? 'shipper' : 'owner' };
};

// Before accepting: the offer must still be live, its load still taking
// offers, and it must be the caller's turn. An owner's application is the
// shipper's to accept; a shipper's request is the owner's. Nobody accepts their
// own offer. Returns the sent response when a rule fails.
const refuseIfNotRespondable = (res, { quote, load, side }) => {
  if (!OPEN_QUOTE_STATUSES.includes(quote.status)) {
    return fail(res, 400, 'QUOTES_ALREADY_DECIDED', `Quote is already ${quote.status}`, { status: quote.status });
  }
  if (!BIDDABLE_LOAD_STATUSES.includes(load.status)) {
    return fail(res, 400, 'QUOTES_LOAD_STATUS_BLOCKS_RESPONSE', `This load is ${load.status}`, { status: load.status });
  }
  if (isExpired(quote) || isExpired(load)) return fail(res, 400, 'QUOTES_OFFER_EXPIRED', 'This offer has expired');
  if (standingOffer(quote).by === side) {
    return fail(res, 400, 'QUOTES_WAITING_ON_OTHER_PARTY', 'Waiting on the other party to respond to your offer');
  }
  return null;
};

// Matches the quote only if nobody has acted on it since it was read, so two
// simultaneous responses can't both apply.
const unchangedSince = (quote) => ({ _id: quote._id, status: quote.status, updatedAt: quote.updatedAt });

// Accepting books one truck: it fills one of the load's slots and creates that
// truck's Booking. Whoever did NOT make the offer accepts it. Once every slot
// is filled the load is booked and the offers still open are closed.
exports.acceptQuote = async (req, res, next) => {
  try {
    const negotiation = await loadNegotiation(req, res);
    if (!negotiation) return;
    if (refuseIfNotRespondable(res, negotiation)) return;
    const { quote, load, side } = negotiation;
    const finalPrice = standingOffer(quote).price;

    // The truck first. Every day the trip needs is added with one conditional
    // update, so two bookings racing for one truck on overlapping days can't
    // both get it.
    const busyDays = busyDaysOf(load);
    let truck = null;
    if (quote.truckId) {
      truck = busyDays.length
        ? await Truck.findOneAndUpdate(
          { _id: quote.truckId, status: 'active', reservedDays: { $nin: busyDays } },
          { $push: { reservedDays: { $each: busyDays } } },
          { new: true },
        )
        : await Truck.findById(quote.truckId);
      if (!truck) {
        const message = busyDays.length > 1
          ? 'That truck is no longer available for all the days this trip needs'
          : 'That truck is no longer available on the pickup date';
        return fail(res, 409, 'QUOTES_TRUCK_NOT_AVAILABLE_ON_DATE', message);
      }
    }
    const releaseTruck = async () => {
      if (truck && busyDays.length) await Truck.updateOne({ _id: truck._id }, { $pull: { reservedDays: { $in: busyDays } } });
    };

    // Then a slot on the load, claimed atomically: when acceptances race for
    // the last slot exactly one matches and gets it.
    const claimed = await Load.findOneAndUpdate(
      { _id: load._id, status: { $in: BIDDABLE_LOAD_STATUSES }, ...HAS_OPEN_SLOT },
      { $inc: { trucksBooked: 1 } },
      { new: true },
    );
    if (!claimed) {
      await releaseTruck();
      return fail(res, 400, 'QUOTES_LOAD_ALREADY_BOOKED', 'This load already has all the trucks it needs');
    }
    const full = trucksBookedOf(claimed) >= trucksNeededOf(claimed);
    if (full) await Load.updateOne({ _id: load._id, status: { $in: BIDDABLE_LOAD_STATUSES } }, { status: 'booked' });

    const accepted = await Quote.findOneAndUpdate(
      unchangedSince(quote),
      { status: 'accepted', acceptedAt: new Date(), acceptedBy: side },
      { new: true },
    );
    if (!accepted) {
      // The quote was withdrawn or declined mid-request: release everything.
      await Load.updateOne({ _id: load._id }, { $inc: { trucksBooked: -1 } });
      if (full) await Load.updateOne({ _id: load._id, status: 'booked' }, { status: load.status });
      await releaseTruck();
      return fail(res, 409, 'QUOTES_CHANGED_UNDERNEATH', CHANGED_UNDERNEATH);
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

    // With every truck found, the other live offers on the load are closed out.
    if (full) await closeOpenOffers(req, load, 'Load no longer available', `${load.goodsType} has all the trucks it needs`);

    const slots = { trucksNeeded: trucksNeededOf(claimed), trucksBooked: trucksBookedOf(claimed) };
    const otherPartyId = side === 'shipper' ? accepted.ownerId : load.shipperId;
    req.io?.to(`user-${otherPartyId}`).emit('quote-accepted', { quote: accepted, booking, load: slots });
    await sendPushToUser(otherPartyId, side === 'shipper'
      ? {
        title: 'Your truck is booked!',
        body: `Your ${formatCurrency(finalPrice)} offer on ${load.goodsType} was accepted`,
        data: { type: 'booking', bookingId: String(booking._id) },
      }
      : {
        title: 'Truck booked',
        body: slots.trucksNeeded > 1
          ? `${slots.trucksBooked} of ${slots.trucksNeeded} trucks booked for ${load.goodsType}`
          : `Your ${formatCurrency(finalPrice)} request for ${load.goodsType} was accepted`,
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

    res.json({ success: true, quote: accepted, booking, load: slots });
  } catch (error) {
    next(error);
  }
};

// Closes every offer still open on a load (it is full, or the shipper has
// enough trucks) and tells their owners.
const closeOpenOffers = async (req, load, title, body) => {
  const losing = await Quote.find({ loadId: load._id, status: { $in: OPEN_QUOTE_STATUSES } }).select('ownerId');
  if (!losing.length) return;
  await Quote.updateMany({ _id: { $in: losing.map((q) => q._id) } }, { status: 'rejected' });
  losing.forEach((q) => req.io?.to(`user-${q.ownerId}`)
    .emit('quote-updated', { quote: { _id: q._id, loadId: load._id, status: 'rejected' } }));
  await sendPushToUsers([...new Set(losing.map((q) => String(q.ownerId)))], {
    title,
    body,
    data: { type: 'load', loadId: String(load._id) },
  });
};
exports.closeOpenOffers = closeOpenOffers;

// Either party walks away from a live offer: declining the other side's offer,
// or withdrawing their own.
exports.rejectQuote = async (req, res, next) => {
  try {
    const negotiation = await loadNegotiation(req, res);
    if (!negotiation) return;
    const { quote, load, side } = negotiation;

    if (!OPEN_QUOTE_STATUSES.includes(quote.status)) {
      return fail(res, 400, 'QUOTES_ALREADY_DECIDED', `Quote is already ${quote.status}`, { status: quote.status });
    }

    const rejected = await Quote.findOneAndUpdate(
      { _id: quote._id, status: { $in: OPEN_QUOTE_STATUSES } },
      { status: 'rejected' },
      { new: true },
    );
    if (!rejected) return fail(res, 409, 'QUOTES_CHANGED_UNDERNEATH', CHANGED_UNDERNEATH);

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
