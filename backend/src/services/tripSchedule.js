const { addDays } = require('./nepalTime');

// How many Nepal calendar days a trip keeps its truck busy.
//
// A loaded truck on Nepal's roads averages far less than a car does, and a
// driver can only drive so long in a day, so a long haul takes several days
// and the truck can't take another job in between. These are planning
// numbers, not promises: they only decide which days a booking blocks.
//
//   Kathmandu to Pokhara (~200 km)   1 day
//   Kathmandu to Nepalgunj (~530 km) 3 days
//
// The truck is blocked from the pickup day until the trip should be over, not
// for the drive back, so an owner can still pick up a return load on the way.

const TRUCK_AVG_KMH = 28; // loaded truck, mixed highway and hill road
const HANDLING_HOURS = 2; // loading and unloading
const DRIVING_HOURS_PER_DAY = 10;
const MAX_TRIP_DAYS = 14;

// Whole days a trip of `km` needs, at least one.
const tripDaysFor = (km) => {
  if (!km || km <= 0) return 1;
  const hours = km / TRUCK_AVG_KMH + HANDLING_HOURS;
  return Math.min(MAX_TRIP_DAYS, Math.max(1, Math.ceil(hours / DRIVING_HOURS_PER_DAY)));
};

// Driving minutes for a loaded truck over `km` of road. A routing server's
// time is for a car, so a truck takes at least that and usually longer; the
// planning speed above sets the slower pace.
const truckMinutesFor = (km, carMinutes = 0) => (
  km > 0 ? Math.round(Math.max(carMinutes, (km / TRUCK_AVG_KMH) * 60)) : 0
);

// The day keys from `startDay` for `count` days: ["2026-09-16", "2026-09-17"].
const daysFrom = (startDay, count = 1) => Array.from({ length: Math.max(1, count) }, (_, i) => addDays(startDay, i));

// The days a load would keep a truck busy, or [] for a load with no pickup day.
const busyDaysOf = (load) => (load?.pickupDay ? daysFrom(load.pickupDay, load.tripDays || 1) : []);

module.exports = { tripDaysFor, truckMinutesFor, daysFrom, busyDaysOf, MAX_TRIP_DAYS };
