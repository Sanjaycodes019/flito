const Booking = require('../models/Booking');
const Load = require('../models/Load');
const Truck = require('../models/Truck');
const User = require('../models/User');

const { PARTY_FIELDS, withVerification } = require('../services/partyView');

const TRUCK_FIELDS = 'registrationNumber truckType capacity makeModel verificationStatus';

// A booking as its parties see it, with who and what is verified.
const bookingView = (booking) => withVerification(booking, {
  people: ['shipperId', 'ownerId', 'driverId'],
  trucks: ['truckId'],
});
const { requiresVerification } = require('../services/kycPolicy');
const { sendPushToUser, sendPushToUsers } = require('../services/push');

// A ref may be a raw ObjectId or, on populated queries, a full user document.
// Normalize both to the id string before comparing.
const idOf = (ref) => (ref ? String(ref._id || ref) : null);

const isParty = (booking, userId) =>
  [booking.shipperId, booking.ownerId, booking.driverId].some((ref) => idOf(ref) === userId);

// List bookings the requesting user is part of (as shipper, owner, or driver)
exports.listMyBookings = async (req, res, next) => {
  try {
    const { userId, role } = req.user;
    const filter = role === 'shipper' ? { shipperId: userId }
      : role === 'owner' ? { ownerId: userId }
      : role === 'driver' ? { driverId: userId }
      : {};

    const bookings = await Booking.find(filter)
      .populate('loadId')
      .populate('shipperId', PARTY_FIELDS)
      .populate('ownerId', PARTY_FIELDS)
      .populate('driverId', PARTY_FIELDS)
      .populate('truckId', TRUCK_FIELDS)
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings: bookings.map(bookingView) });
  } catch (error) {
    next(error);
  }
};

exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('loadId')
      .populate('shipperId', PARTY_FIELDS)
      .populate('ownerId', PARTY_FIELDS)
      .populate('driverId', PARTY_FIELDS)
      .populate('truckId', TRUCK_FIELDS);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!isParty(booking, req.user.userId)) {
      return res.status(403).json({ success: false, message: 'Not part of this booking' });
    }

    res.json({ success: true, booking: bookingView(booking) });
  } catch (error) {
    next(error);
  }
};

// A driver can join a booking only before the trip is under way.
const DRIVER_ASSIGNABLE_STATUSES = ['pending', 'confirmed'];

exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (idOf(booking.ownerId) !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Only the owner can assign a driver' });
    }
    if (!DRIVER_ASSIGNABLE_STATUSES.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `A driver can't be assigned to a booking that is ${booking.status.replace('_', ' ')}`,
      });
    }

    // Must be a real, active driver account. Any id used to be accepted,
    // including a shipper's or one that doesn't exist.
    const driver = driverId
      ? await User.findOne({ _id: driverId, role: 'driver' }).select('firstName kycStatus status')
      : null;
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });
    if (driver.status !== 'active') {
      return res.status(400).json({ success: false, message: `${driver.firstName}'s account is ${driver.status}` });
    }
    if (requiresVerification('beAssignedToBooking', 'driver') && driver.kycStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        code: 'DRIVER_NOT_VERIFIED',
        message: `${driver.firstName} hasn't completed identity verification, so they can't be assigned to a booking yet`,
      });
    }

    booking.driverId = driver._id;
    if (booking.status === 'pending') booking.status = 'confirmed';
    await booking.save();

    req.io?.to(`user-${driver._id}`).emit('booking-assigned', { booking });
    req.io?.to(`user-${booking.shipperId}`).emit('booking-status-changed', { booking });
    await sendPushToUser(driver._id, {
      title: 'New delivery assigned',
      body: `You've been assigned to a booking worth Rs. ${(booking.totalAmount || 0).toLocaleString('en-IN')}`,
      data: { type: 'booking', bookingId: String(booking._id) },
    });
    await sendPushToUser(booking.shipperId, {
      title: 'Driver assigned',
      body: `${driver.firstName} will handle your delivery`,
      data: { type: 'booking', bookingId: String(booking._id) },
    });

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// Which party a user is on a given booking (a user can only be one of these).
const partyOf = (booking, userId) => {
  if (idOf(booking.shipperId) === userId) return 'shipper';
  if (idOf(booking.ownerId) === userId) return 'owner';
  if (idOf(booking.driverId) === userId) return 'driver';
  return null;
};

// Only the assigned driver physically moves the load, so only they may report
// pickup/dropoff progress. Cancellation is a commercial decision and belongs to
// the shipper or owner, and only before the load is in transit.
const CANCELLABLE_FROM = ['pending', 'confirmed'];

exports.updateStatus = async (req, res, next) => {
  try {
    const { status, pickupStatus, dropoffStatus } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const party = partyOf(booking, req.user.userId);
    if (!party) {
      return res.status(403).json({ success: false, message: 'Not part of this booking' });
    }

    if ((pickupStatus || dropoffStatus) && party !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only the assigned driver can report pickup or delivery progress' });
    }

    if (status) {
      if (status === 'cancelled') {
        if (party === 'driver') {
          return res.status(403).json({ success: false, message: 'Drivers cannot cancel a booking' });
        }
        if (!CANCELLABLE_FROM.includes(booking.status)) {
          return res.status(400).json({ success: false, message: `Cannot cancel a booking that is ${booking.status}` });
        }
      } else if (['in_transit', 'completed'].includes(status)) {
        if (party !== 'driver') {
          return res.status(403).json({ success: false, message: 'Only the assigned driver can advance delivery status' });
        }
      } else if (status === 'confirmed') {
        if (party !== 'owner') {
          return res.status(403).json({ success: false, message: 'Only the owner can confirm a booking' });
        }
      } else {
        return res.status(400).json({ success: false, message: `Unsupported status transition: ${status}` });
      }

      if (['completed', 'cancelled'].includes(booking.status)) {
        return res.status(400).json({ success: false, message: `Booking is already ${booking.status}` });
      }
    }

    if (status) booking.status = status;
    if (pickupStatus) booking.pickupStatus = pickupStatus;
    if (dropoffStatus) booking.dropoffStatus = dropoffStatus;
    await booking.save();

    // A finished or cancelled booking frees its truck's day for other loads.
    if (booking.truckId && ['completed', 'cancelled'].includes(status)) {
      const load = await Load.findById(booking.loadId).select('pickupDay');
      if (load?.pickupDay) await Truck.updateOne({ _id: booking.truckId }, { $pull: { reservedDays: load.pickupDay } });
    }

    const parties = [booking.shipperId, booking.ownerId, booking.driverId].filter(Boolean);
    parties.forEach((id) => req.io?.to(`user-${id}`).emit('booking-status-changed', { booking }));

    // One push for whichever change is most significant to the OTHER
    // parties, never to req.user.userId, who already knows they caused it.
    const notify = (title, body) => sendPushToUsers(
      parties.filter((id) => String(id) !== req.user.userId),
      { title, body, data: { type: 'booking', bookingId: String(booking._id) } },
    );
    if (status === 'cancelled') await notify('Booking cancelled', 'A booking you were part of has been cancelled');
    else if (dropoffStatus === 'delivered') await notify('Delivered', 'The cargo has been delivered');
    else if (pickupStatus === 'picked_up') await notify('Picked up', 'Your cargo is on its way');

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// Driver pushes a live GPS ping for an in-transit booking
exports.updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (idOf(booking.driverId) !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Only the assigned driver can update location' });
    }
    // GPS pings are only meaningful while cargo is moving; a booking that
    // hasn't started or has already ended shouldn't gain a "current" location.
    if (booking.status !== 'in_transit') {
      return res.status(400).json({
        success: false,
        message: `Location can only be shared while a booking is in transit (this one is ${booking.status.replace('_', ' ')})`,
      });
    }

    const locationUpdatedAt = new Date();
    booking.currentLocation = { lat, lng };
    booking.locationUpdatedAt = locationUpdatedAt;
    await booking.save();

    const payload = { bookingId: booking._id, lat, lng, updatedAt: locationUpdatedAt };
    req.io?.to(`user-${booking.shipperId}`).emit('location-update', payload);
    req.io?.to(`user-${booking.ownerId}`).emit('location-update', payload);

    res.json({ success: true, currentLocation: booking.currentLocation, locationUpdatedAt });
  } catch (error) {
    next(error);
  }
};

// Shipper or owner rates the other party after completion
// The shipper rates the owner and the owner rates the shipper, once each, after
// the job is done. The score is rolled into the rated user's average rating.
exports.rateBooking = async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const party = partyOf(booking, req.user.userId);
    if (party !== 'shipper' && party !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only the shipper or owner can rate this booking' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only rate a completed booking' });
    }

    const field = party === 'shipper' ? 'ownerRating' : 'shipperRating';
    const ratedUserId = party === 'shipper' ? booking.ownerId : booking.shipperId;

    // Conditional on the rating still being unset, so a retry or double tap
    // can't record, and count, a second score.
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, [`${field}.rating`]: { $exists: false } },
      { $set: { [field]: { rating, review, ratedAt: new Date() } } },
      { new: true },
    );
    if (!updated) {
      return res.status(400).json({ success: false, message: 'You have already rated this booking' });
    }

    // One pipeline update computes the new running average from the stored
    // values, so ratings landing at the same time from different bookings
    // can't overwrite each other.
    const total = { $ifNull: ['$totalRatings', 0] };
    await User.updateOne({ _id: ratedUserId }, [
      {
        $set: {
          rating: {
            $divide: [
              { $add: [{ $multiply: [{ $ifNull: ['$rating', 0] }, total] }, rating] },
              { $add: [total, 1] },
            ],
          },
          totalRatings: { $add: [total, 1] },
        },
      },
    ]);

    res.json({ success: true, booking: updated });
  } catch (error) {
    next(error);
  }
};
