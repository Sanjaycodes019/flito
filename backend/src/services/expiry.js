const Load = require('../models/Load');
const Quote = require('../models/Quote');

// How long a posting and an offer stay actionable. Short windows keep the
// marketplace fresh; a shipper can relist an expired load in one tap.
const LOAD_TTL_MS = 24 * 60 * 60 * 1000;
const QUOTE_TTL_MS = 48 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

// Loads still taking bids, and quotes still awaiting a response.
const BIDDABLE_LOAD_STATUSES = ['open', 'quoted', 'negotiating'];
const OPEN_QUOTE_STATUSES = ['pending', 'countered'];

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
  const run = () => expireStale().catch((err) => console.error('[expiry] sweep failed:', err.message));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref(); // never keep the process alive just for the sweep
  return timer;
};

module.exports = {
  LOAD_TTL_MS,
  QUOTE_TTL_MS,
  BIDDABLE_LOAD_STATUSES,
  OPEN_QUOTE_STATUSES,
  isExpired,
  expireStale,
  startExpirySweep,
};
