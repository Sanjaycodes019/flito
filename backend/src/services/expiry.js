const logger = require('../utils/logger');
const Load = require('../models/Load');
const Quote = require('../models/Quote');
const { endOfNepalDay } = require('./nepalTime');

// A load takes offers until the end of its pickup day, and for at least
// LOAD_MIN_TTL_MS, so a load posted late in the evening for today still gets a
// fair window. An offer stays open QUOTE_TTL_MS (a counter-offer restarts it)
// but never outlives its load.
const LOAD_MIN_TTL_MS = 12 * 60 * 60 * 1000;
const QUOTE_TTL_MS = 48 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Loads still taking bids, and quotes still awaiting a response.
const BIDDABLE_LOAD_STATUSES = ['open', 'quoted', 'negotiating'];
const OPEN_QUOTE_STATUSES = ['pending', 'countered'];

const loadExpiresAt = (pickupDay, now = Date.now()) =>
  new Date(Math.max(endOfNepalDay(pickupDay).getTime(), now + LOAD_MIN_TTL_MS));

const offerExpiresAt = (load, now = Date.now()) => {
  const loadEnds = load?.expiresAt ? new Date(load.expiresAt).getTime() : Infinity;
  return new Date(Math.min(now + QUOTE_TTL_MS, loadEnds));
};

// Documents created before expiry existed have no expiresAt and never expire.
const isExpired = (doc, now = Date.now()) =>
  Boolean(doc?.expiresAt) && new Date(doc.expiresAt).getTime() <= now;

// Expiry is enforced at action time via isExpired, so no request ever acts on a
// stale offer even between sweeps. The sweep only brings stored statuses in
// line so lists and badges read "expired".
const expireStale = async (now = new Date()) => {
  const staleLoadIds = await Load.distinct('_id', {
    status: { $in: BIDDABLE_LOAD_STATUSES },
    expiresAt: { $lte: now },
  });

  const loads = staleLoadIds.length
    ? (await Load.updateMany(
      // Re-check status: a load booked since the read above must not expire.
      { _id: { $in: staleLoadIds }, status: { $in: BIDDABLE_LOAD_STATUSES } },
      { status: 'expired' },
    )).modifiedCount
    : 0;

  // A quote lapses with its load even if its own window is still open.
  const quotes = (await Quote.updateMany(
    {
      status: { $in: OPEN_QUOTE_STATUSES },
      $or: [{ expiresAt: { $lte: now } }, { loadId: { $in: staleLoadIds } }],
    },
    { status: 'expired' },
  )).modifiedCount;

  return { loads, quotes };
};

const startExpirySweep = (intervalMs = SWEEP_INTERVAL_MS) => {
  const run = () => expireStale().catch((err) => logger.error('[expiry] sweep failed:', err.message));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref(); // never keep the process alive just for the sweep
  return timer;
};

module.exports = {
  LOAD_MIN_TTL_MS,
  QUOTE_TTL_MS,
  BIDDABLE_LOAD_STATUSES,
  OPEN_QUOTE_STATUSES,
  loadExpiresAt,
  offerExpiresAt,
  isExpired,
  expireStale,
  startExpirySweep,
};
