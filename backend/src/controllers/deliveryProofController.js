const Booking = require('../models/Booking');
const storage = require('../services/storage');
const { sendPushToUsers } = require('../services/push');
const { fail } = require('../utils/respond');

const MAX_DELIVERY_PHOTOS = 5;

const idOf = (ref) => (ref ? String(ref._id || ref) : null);

// Proof of delivery is evidence for the shipper and owner, so only the assigned
// driver adds it, only once the cargo is picked up, and it is never removed.
const canAddProof = (booking) =>
  booking.status === 'completed'
  || (booking.status === 'in_transit' && booking.pickupStatus === 'picked_up');

// Runs before the upload is parsed, so a request that can't succeed is refused
// without buffering its files.
exports.loadProofBooking = async (req, res, next) => {
  try {
    if (!storage.isConfigured()) {
      return fail(res, 503, 'DELIVERY_UPLOADS_NOT_CONFIGURED', 'File uploads are not configured on this server');
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return fail(res, 404, 'DELIVERY_BOOKING_NOT_FOUND', 'Booking not found');

    if (idOf(booking.driverId) !== req.user.userId) {
      return fail(res, 403, 'DELIVERY_FORBIDDEN', 'Only the assigned driver can add proof of delivery');
    }
    if (!canAddProof(booking)) {
      return fail(res, 400, 'DELIVERY_NOT_READY', 'Proof of delivery can be added once the load has been picked up');
    }

    req.booking = booking;
    next();
  } catch (error) {
    next(error);
  }
};

exports.addDeliveryProof = async (req, res, next) => {
  try {
    const { booking } = req;
    const files = req.files || [];
    const existing = booking.deliveryPhotos.length;

    if (!files.length) {
      return fail(res, 400, 'DELIVERY_PHOTO_REQUIRED', 'Attach at least one photo');
    }
    if (existing + files.length > MAX_DELIVERY_PHOTOS) {
      return fail(
        res,
        400,
        'DELIVERY_MAX_PHOTOS',
        `A booking can have at most ${MAX_DELIVERY_PHOTOS} delivery photos (it has ${existing})`,
        { max: MAX_DELIVERY_PHOTOS, count: existing },
      );
    }

    const uploaded = await storage.uploadImages(files, { folder: `flito/delivery/${booking._id}` });
    const entries = uploaded.map((photo) => ({ ...photo, uploadedAt: new Date() }));

    // Re-checked atomically so concurrent uploads can't exceed the limit.
    let updated;
    try {
      updated = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          driverId: booking.driverId,
          status: { $in: ['in_transit', 'completed'] },
          $expr: { $lte: [{ $add: [{ $size: { $ifNull: ['$deliveryPhotos', []] } }, entries.length] }, MAX_DELIVERY_PHOTOS] },
        },
        { $push: { deliveryPhotos: { $each: entries } } },
        { new: true },
      );
    } catch (error) {
      await storage.deleteAssets(uploaded.map((photo) => photo.publicId));
      throw error;
    }

    if (!updated) {
      await storage.deleteAssets(uploaded.map((photo) => photo.publicId));
      return fail(res, 409, 'DELIVERY_BOOKING_CHANGED', 'This booking changed while uploading. Refresh and try again.');
    }

    [updated.shipperId, updated.ownerId].forEach((id) => req.io?.to(`user-${id}`)
      .emit('delivery-proof-added', { bookingId: updated._id, count: updated.deliveryPhotos.length }));
    await sendPushToUsers([updated.shipperId, updated.ownerId], {
      title: 'Delivery photos added',
      body: 'The driver added proof-of-delivery photos',
      data: { type: 'booking', bookingId: String(updated._id) },
    });

    res.status(201).json({ success: true, booking: updated });
  } catch (error) {
    next(error);
  }
};

// A signature can be recaptured (e.g. a mis-drawn one) under the same window
// as photos. It isn't locked the moment it's first set.
exports.addDeliverySignature = async (req, res, next) => {
  try {
    const { booking } = req;

    if (!req.file) {
      return fail(res, 400, 'DELIVERY_SIGNATURE_FILE_REQUIRED', 'Attach the signature image');
    }

    const [uploaded] = await storage.uploadImages([req.file], { folder: `flito/delivery/${booking._id}/signature` });
    const previous = booking.deliverySignature;

    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, driverId: booking.driverId, status: { $in: ['in_transit', 'completed'] } },
      { deliverySignature: { url: uploaded.url, publicId: uploaded.publicId, capturedAt: new Date() } },
      { new: true },
    );

    if (!updated) {
      await storage.deleteAssets([uploaded.publicId]);
      return fail(res, 409, 'DELIVERY_BOOKING_CHANGED', 'This booking changed while uploading. Refresh and try again.');
    }

    if (previous?.publicId) await storage.deleteAssets([previous.publicId]);

    [updated.shipperId, updated.ownerId].forEach((id) => req.io?.to(`user-${id}`)
      .emit('delivery-proof-added', { bookingId: updated._id, count: updated.deliveryPhotos.length }));
    await sendPushToUsers([updated.shipperId, updated.ownerId], {
      title: 'Delivery signed',
      body: 'The recipient signed for this delivery',
      data: { type: 'booking', bookingId: String(updated._id) },
    });

    res.status(201).json({ success: true, booking: updated });
  } catch (error) {
    next(error);
  }
};

exports.MAX_DELIVERY_PHOTOS = MAX_DELIVERY_PHOTOS;
