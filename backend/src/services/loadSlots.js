// A load can need more than one truck: 30 tonnes of cement going out on three
// 10-tonne trucks. Each truck is a slot. Owners apply with trucks, the shipper
// accepts them one at a time, and every accepted truck is its own booking (its
// own driver, payment and delivery proof). The load stays on the market until
// every slot is filled or the shipper says they have enough.

const MAX_TRUCKS_PER_LOAD = 10;

// Requests a shipper can have waiting with owners at once, beyond the trucks
// still needed: a couple spare, since not every owner says yes.
const SPARE_REQUESTS = 2;

// Loads posted before slots existed need one truck.
const trucksNeededOf = (load) => load?.trucksNeeded || 1;
const trucksBookedOf = (load) => load?.trucksBooked || 0;
const openSlotsOf = (load) => Math.max(0, trucksNeededOf(load) - trucksBookedOf(load));

// What each truck carries: the load split evenly, rounded up to the kilo.
const weightPerTruck = (load) => (load?.weight ? Math.ceil(load.weight / trucksNeededOf(load)) : null);

const maxOpenRequestsFor = (load) => openSlotsOf(load) + SPARE_REQUESTS;

// Matches a load with at least one slot still free, for atomic updates.
const HAS_OPEN_SLOT = {
  $expr: { $lt: [{ $ifNull: ['$trucksBooked', 0] }, { $ifNull: ['$trucksNeeded', 1] }] },
};

module.exports = {
  MAX_TRUCKS_PER_LOAD,
  SPARE_REQUESTS,
  trucksNeededOf,
  trucksBookedOf,
  openSlotsOf,
  weightPerTruck,
  maxOpenRequestsFor,
  HAS_OPEN_SLOT,
};
