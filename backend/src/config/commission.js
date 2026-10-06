// FLITO's fee on each completed trip, paid by the truck owner once a month.
// Shippers never pay FLITO anything. Owners see each trip's fee (before they
// offer, on the booking, on their bill) but never this rule: it stays here.
//
// The fee is FEE_RATE of the trip's fare, at least MIN_FEE, but never more
// than MAX_RATE of the fare. So a small trip pays 4% (under Rs. 1,000), a trip
// of Rs. 25,000 to about Rs. 33,000 pays Rs. 1,000, and a bigger one pays 3%.
// The fee never falls as the fare rises.
//
//   fare Rs. 15,000   → Rs. 600   (4%)
//   fare Rs. 30,000   → Rs. 1,000
//   fare Rs. 60,000   → Rs. 1,800 (3%)
//   fare Rs. 1,50,000 → Rs. 4,500 (3%)
//
// To help owners start: no fee until fees start (COMMISSION_START_DATE), and
// each owner's first few trips under fees are free (welcomeTrips).
const FEE_RATE = 0.03;
const MIN_FEE = 1000;
const MAX_RATE = 0.04;

// How many of each owner's first completed trips carry no fee: 5, or
// COMMISSION_WELCOME_TRIPS.
const DEFAULT_WELCOME_TRIPS = 5;
const welcomeTrips = () => {
  const value = Number.parseInt(process.env.COMMISSION_WELCOME_TRIPS, 10);
  return Number.isInteger(value) && value >= 0 ? value : DEFAULT_WELCOME_TRIPS;
};

// Trips are billed by Nepali (BS) month. A month's fees are due by this day of
// the next month: Ashwin's by 15 Kartik.
const COMMISSION_DUE_DAY = 15;

// Fees apply to trips booked on or after this Nepal day, never to one booked
// before (the Terms promise owners notice before any fee applies). 1 Magh 2083
// by default, three months free from launch; COMMISSION_START_DATE (YYYY-MM-DD,
// AD) changes it.
const DEFAULT_START_DAY = '2027-01-15';
const commissionStartDay = () => {
  const value = process.env.COMMISSION_START_DATE;
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : DEFAULT_START_DAY;
};

// Whether an owner with fees past their due date is stopped from making new
// offers (and accepting a shipper's) until they pay. Trips already booked go
// on either way.
const BLOCK_OFFERS_WHEN_OVERDUE = true;

// The fee on one trip's fare, in whole rupees, and the share of the fare it
// is (`rate`, e.g. 0.0333 for Rs. 1,000 on Rs. 30,000).
const commissionFor = (fare) => {
  const amount = Math.max(0, Math.round(Number(fare) || 0));
  if (!amount) return { rate: 0, amount: 0 };
  const fee = Math.min(Math.round(amount * MAX_RATE), Math.max(MIN_FEE, Math.round(amount * FEE_RATE)));
  return { rate: Math.round((fee / amount) * 10000) / 10000, amount: fee };
};

module.exports = {
  FEE_RATE,
  MIN_FEE,
  MAX_RATE,
  COMMISSION_DUE_DAY,
  BLOCK_OFFERS_WHEN_OVERDUE,
  welcomeTrips,
  commissionFor,
  commissionStartDay,
};
