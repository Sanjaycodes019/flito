const Truck = require('../models/Truck');
const Booking = require('../models/Booking');
const { NOMINAL_CAPACITY_KG } = require('../config/truckTypes');
const { requiresVerification } = require('./kycPolicy');
const { describeArea, estimateRoadKm } = require('./nepalLocations');
const { nepalDay, startOfNepalDay } = require('./nepalTime');
const { formatKg } = require('../utils/format');

// Which trucks can carry a load, and which suit it best.
//
// A truck is a candidate only when it can actually do the job: it is active,
// its owner is verified and active, it carries at least the load's weight,
// both stops are inside its service area, and it isn't already booked on the
// pickup day. Candidates are then scored out of 100 on five signals
// (WEIGHTS), and the strongest become the reasons a shipper sees on each truck.

// How much each signal counts, out of 100.
const WEIGHTS = {
  fit: 30, // how well the load fills the truck
  proximity: 30, // how close the truck is based to the pickup
  reputation: 20, // the owner's rating and completed trips
  price: 15, // the asking price against the cheapest asking price
  readiness: 5, // a verified driver on the truck, and current insurance
};

// Filling this share of a truck counts as a full fit. A much bigger truck than
// the load needs still works, but costs more to run, so it scores lower.
const GOOD_FILL = 0.6;
const MIN_FIT = 0.15;

// A truck based this far from the pickup or more gets no proximity score.
const PROXIMITY_RANGE_KM = 250;

// Ratings are averaged in with a prior, as if every owner started with
// PRIOR_REVIEWS reviews of PRIOR_RATING, so one 5-star review can't outrank a
// long good record.
const PRIOR_RATING = 4;
const PRIOR_REVIEWS = 3;
const TRIPS_FOR_FULL_EXPERIENCE = 20;

const MAX_MATCHES = 30;
const CANDIDATE_LIMIT = 500;

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const roundToHundred = (n) => Math.round(n / 100) * 100;

const capacityOf = (truck) => truck.capacity || NOMINAL_CAPACITY_KG[truck.truckType] || null;

const displayName = (user) => user?.companyName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Truck owner';

// What the owner's own rates come to for a trip of `distanceKm`, or null when
// the truck has no rate (the shipper then makes an offer).
const askingPriceFor = (truck, distanceKm) => {
  if (!truck.ratePerKm || !distanceKm) return null;
  return Math.max(truck.minimumCharge || 0, roundToHundred(truck.ratePerKm * distanceKm));
};

// Insurance that runs at least until the end of today in Nepal.
const insuranceIsCurrent = (truck, now = new Date()) => Boolean(truck.insurance?.validUntil)
  && new Date(truck.insurance.validUntil).getTime() >= startOfNepalDay(nepalDay(now)).getTime();

// Why a load falls outside a truck's service area, or null when it doesn't.
// A truck without a base can't be placed, so it counts as working anywhere.
const serviceAreaReason = (truck, load) => {
  const area = truck.serviceArea || 'nepal';
  const base = truck.baseLocation;
  if (area === 'nepal' || !base?.districtId) return null;

  const key = area === 'district' ? 'districtId' : 'provinceId';
  const inside = (stop) => !stop?.[key] || stop[key] === base[key];
  if (inside(load.pickupLocation) && inside(load.dropoffLocation)) return null;

  const names = describeArea(base);
  return area === 'district'
    ? `Only takes loads within ${names?.district ? `${names.district} district` : 'its district'}`
    : `Only takes loads within ${names?.province || 'its province'}`;
};

// Why a truck can't carry a load, or null when it can. The same rules decide
// which trucks a shipper sees and which trucks an owner may offer.
const unavailableReason = (truck, load) => {
  if (truck.status !== 'active') return `This truck is marked ${truck.status}`;
  const capacity = capacityOf(truck);
  if (!capacity) return "Add this truck's capacity to offer it";
  if (load.weight && load.weight > capacity) {
    return `Carries up to ${formatKg(capacity)}, and this load is ${formatKg(load.weight)}`;
  }
  const outsideArea = serviceAreaReason(truck, load);
  if (outsideArea) return outsideArea;
  if (load.pickupDay && (truck.reservedDays || []).includes(load.pickupDay)) return 'Already booked on the pickup date';
  return null;
};

const ownerCanTakeBookings = (owner) => Boolean(owner)
  && owner.status === 'active'
  && (!requiresVerification('makeOffer', 'owner') || owner.kycStatus === 'approved');

const driverIsReady = (driver) => Boolean(driver)
  && driver.status === 'active'
  && (!requiresVerification('beAssignedToBooking', 'driver') || driver.kycStatus === 'approved');

// The score out of 100 and up to three reasons, strongest first.
const scoreTruck = ({
  load, capacity, owner, trips, distanceToPickupKm, askingPrice, lowestAsking, pricedCount, driverReady, insured,
}) => {
  const fill = load.weight ? load.weight / capacity : null;
  const reviews = owner.totalRatings || 0;
  const smoothedRating = ((owner.rating || 0) * reviews + PRIOR_RATING * PRIOR_REVIEWS) / (reviews + PRIOR_REVIEWS);

  const signals = {
    fit: fill == null ? 0.5 : clamp01(Math.max(fill / GOOD_FILL, MIN_FIT)),
    proximity: distanceToPickupKm == null ? 0.5 : clamp01(1 - distanceToPickupKm / PROXIMITY_RANGE_KM),
    reputation: 0.75 * clamp01((smoothedRating - 1) / 4) + 0.25 * clamp01(trips / TRIPS_FOR_FULL_EXPERIENCE),
    price: askingPrice == null || lowestAsking == null ? 0.5 : clamp01(lowestAsking / askingPrice),
    readiness: (driverReady ? 0.6 : 0) + (insured ? 0.4 : 0),
  };

  const score = Math.round(Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + weight * signals[key], 0));

  const reasons = [
    fill != null && signals.fit >= 0.8 && {
      strength: WEIGHTS.fit * signals.fit,
      text: `Fills ${Math.round(fill * 100)}% of the truck`,
    },
    distanceToPickupKm != null && signals.proximity >= 0.6 && {
      strength: WEIGHTS.proximity * signals.proximity,
      text: distanceToPickupKm <= 15 ? 'Based near the pickup' : `Based about ${distanceToPickupKm} km from the pickup`,
    },
    askingPrice != null && askingPrice === lowestAsking && pricedCount > 1 && {
      strength: WEIGHTS.price,
      text: 'Lowest asking price',
    },
    reviews > 0 && smoothedRating >= 4.2 && {
      strength: WEIGHTS.reputation * signals.reputation,
      text: `Rated ${owner.rating.toFixed(1)} by ${reviews} ${reviews === 1 ? 'shipper' : 'shippers'}`,
    },
    driverReady && { strength: WEIGHTS.readiness * 0.6, text: 'Driver assigned' },
  ]
    .filter(Boolean)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map((reason) => reason.text);

  return { score, reasons };
};

// What a shipper may see of a truck before booking it: what it is and what it
// offers, never its registration, chassis, engine or insurance numbers.
const publicTruck = (truck, insured) => ({
  _id: truck._id,
  truckType: truck.truckType,
  bodyType: truck.bodyType || null,
  capacity: capacityOf(truck),
  makeModel: truck.makeModel || null,
  year: truck.year || null,
  fuelType: truck.fuelType || null,
  cargoBed: truck.cargoBed?.lengthFt ? truck.cargoBed : null,
  features: truck.features || {},
  serviceArea: truck.serviceArea || 'nepal',
  insurance: insured ? (truck.insurance.type || 'third-party') : null,
  base: describeArea(truck.baseLocation)?.label || null,
});

// The trucks a shipper can choose for a load, best match first.
const findMatches = async (load) => {
  const filter = { status: 'active' };
  if (load.pickupDay) filter.reservedDays = { $ne: load.pickupDay };
  if (load.weight) filter.$or = [{ capacity: { $gte: load.weight } }, { capacity: null }];

  const trucks = await Truck.find(filter)
    .populate('ownerId', 'firstName lastName companyName rating totalRatings kycStatus status')
    .populate('assignedDriverId', 'kycStatus status')
    .limit(CANDIDATE_LIMIT)
    .lean();

  const candidates = trucks.filter((truck) => ownerCanTakeBookings(truck.ownerId) && !unavailableReason(truck, load));
  if (!candidates.length) return [];

  const tripRows = await Booking.aggregate([
    { $match: { ownerId: { $in: candidates.map((truck) => truck.ownerId._id) }, status: 'completed' } },
    { $group: { _id: '$ownerId', trips: { $sum: 1 } } },
  ]);
  const tripsByOwner = new Map(tripRows.map((row) => [String(row._id), row.trips]));

  const tripKm = load.distanceKm ?? estimateRoadKm(load.pickupLocation, load.dropoffLocation);
  const priced = candidates.map((truck) => ({
    truck,
    askingPrice: askingPriceFor(truck, tripKm),
    distanceToPickupKm: truck.baseLocation?.localLevelId ? estimateRoadKm(truck.baseLocation, load.pickupLocation) : null,
  }));
  const prices = priced.map((entry) => entry.askingPrice).filter((price) => price != null);
  const lowestAsking = prices.length ? Math.min(...prices) : null;

  return priced
    .map(({ truck, askingPrice, distanceToPickupKm }) => {
      const owner = truck.ownerId;
      const capacity = capacityOf(truck);
      const trips = tripsByOwner.get(String(owner._id)) || 0;
      const driverReady = driverIsReady(truck.assignedDriverId);
      const insured = insuranceIsCurrent(truck);
      const { score, reasons } = scoreTruck({
        load, capacity, owner, trips, distanceToPickupKm, askingPrice, lowestAsking, pricedCount: prices.length, driverReady, insured,
      });

      return {
        truck: publicTruck(truck, insured),
        owner: {
          _id: owner._id,
          name: displayName(owner),
          rating: owner.rating || 0,
          totalRatings: owner.totalRatings || 0,
          completedTrips: trips,
        },
        distanceToPickupKm,
        fillPercent: load.weight ? Math.round((load.weight / capacity) * 100) : null,
        askingPrice,
        driverReady,
        score,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || (a.askingPrice ?? Infinity) - (b.askingPrice ?? Infinity))
    .slice(0, MAX_MATCHES);
};

module.exports = {
  WEIGHTS,
  capacityOf,
  askingPriceFor,
  insuranceIsCurrent,
  unavailableReason,
  driverIsReady,
  findMatches,
};
