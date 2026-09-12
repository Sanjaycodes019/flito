const Booking = require('../models/Booking');

// A ref may be a raw ObjectId or, on populated queries, a full user document —
// normalize both to the id string before comparing.
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
      .populate('shipperId', 'firstName lastName')
      .populate('ownerId', 'firstName lastName companyName')
      .populate('driverId', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
};

exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('loadId')
      .populate('shipperId', 'firstName lastName')
      .populate('ownerId', 'firstName lastName companyName')
      .populate('driverId', 'firstName lastName');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!isParty(booking, req.user.userId)) {
      return res.status(403).json({ success: false, message: 'Not part of this booking' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// Owner assigns a driver to a confirmed booking
exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (idOf(booking.ownerId) !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Only the owner can assign a driver' });
    }

    booking.driverId = driverId;
    if (booking.status === 'pending') booking.status = 'confirmed';
    await booking.save();

    req.io?.to(`user-${driverId}`).emit('booking-assigned', { booking });
    req.io?.to(`user-${booking.shipperId}`).emit('booking-status-changed', { booking });

    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};

// Driver/owner updates pickup or dropoff status, or overall booking status
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, pickupStatus, dropoffStatus } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!isParty(booking, req.user.userId)) {
      return res.status(403).json({ success: false, message: 'Not part of this booking' });
    }

    if (status) booking.status = status;
    if (pickupStatus) booking.pickupStatus = pickupStatus;
    if (dropoffStatus) booking.dropoffStatus = dropoffStatus;
    await booking.save();

    [booking.shipperId, booking.ownerId, booking.driverId]
      .filter(Boolean)
      .forEach((id) => req.io?.to(`user-${id}`).emit('booking-status-changed', { booking }));

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

    booking.currentLocation = { lat, lng };
    await booking.save();

    req.io?.to(`user-${booking.shipperId}`).emit('location-update', { bookingId: booking._id, lat, lng });
    req.io?.to(`user-${booking.ownerId}`).emit('location-update', { bookingId: booking._id, lat, lng });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Shipper or owner rates the other party after completion
exports.rateBooking = async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only rate a completed booking' });
    }

    if (idOf(booking.shipperId) === req.user.userId) {
      booking.ownerRating = { rating, review, ratedAt: new Date() };
    } else if (idOf(booking.ownerId) === req.user.userId) {
      booking.shipperRating = { rating, review, ratedAt: new Date() };
    } else {
      return res.status(403).json({ success: false, message: 'Not part of this booking' });
    }

    await booking.save();
    res.json({ success: true, booking });
  } catch (error) {
    next(error);
  }
};
