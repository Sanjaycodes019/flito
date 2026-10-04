// A load can go out on several trucks. Each truck is a slot that an owner's
// truck fills once the shipper accepts it. Mirrors the server's
// services/loadSlots.js.

export const MAX_TRUCKS_PER_LOAD = 10;

// Loads posted before slots existed need one truck.
export const trucksNeededOf = (load) => load?.trucksNeeded || 1;
export const trucksBookedOf = (load) => load?.trucksBooked || 0;
export const openSlotsOf = (load) => Math.max(0, trucksNeededOf(load) - trucksBookedOf(load));

// What each truck carries: the load split evenly, rounded up to the kilo.
export const weightPerTruck = (load) => (load?.weight ? Math.ceil(load.weight / trucksNeededOf(load)) : null);
