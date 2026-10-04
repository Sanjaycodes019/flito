const Load = require('../models/Load');
const Truck = require('../models/Truck');
const { busyDaysOf } = require('./tripSchedule');
const { isExpired } = require('./expiry');

// What a booking gives back when it ends, the same whoever ends it (a party
// cancelling, the driver completing, or an admin stepping in):
//   - finished or cancelled: its truck's days are free for other loads;
//   - cancelled: its slot on the load comes back, and the load goes back on
//     the market so the shipper can find another truck while there is time.
const releaseBooking = async (booking, endedAs) => {
  if (booking.truckId && ['completed', 'cancelled'].includes(endedAs)) {
    const load = await Load.findById(booking.loadId).select('pickupDay tripDays');
    const busyDays = busyDaysOf(load);
    if (busyDays.length) await Truck.updateOne({ _id: booking.truckId }, { $pull: { reservedDays: { $in: busyDays } } });
  }

  if (endedAs === 'cancelled') {
    const load = await Load.findOneAndUpdate(
      { _id: booking.loadId, trucksBooked: { $gt: 0 } },
      { $inc: { trucksBooked: -1 } },
      { new: true },
    );
    // Past its window, it stays booked with the trucks it still has.
    const reopen = !isExpired(load) ? 'open' : load.trucksBooked === 0 ? 'expired' : null;
    if (load?.status === 'booked' && reopen) {
      await Load.updateOne({ _id: load._id, status: 'booked' }, { status: reopen });
    }
  }
};

module.exports = { releaseBooking };
