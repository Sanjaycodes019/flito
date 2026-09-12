const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    loadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Load',
      required: true,
    },
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quote',
      required: true,
    },
    shipperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_transit', 'completed', 'cancelled'],
      default: 'pending',
    },

    totalAmount: Number,
    amountPaid: {
      type: Number,
      default: 0,
    },
    amountPending: Number,

    paymentMethod: {
      type: String,
      enum: ['khalti', 'esewa', 'cash'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },

    pickupStatus: {
      type: String,
      enum: ['pending', 'arrived', 'picked_up'],
      default: 'pending',
    },
    dropoffStatus: {
      type: String,
      enum: ['pending', 'arrived', 'delivered'],
      default: 'pending',
    },

    currentLocation: {
      lat: Number,
      lng: Number,
    },

    deliveryPhotos: [String],
    deliverySignature: String,

    shipperRating: {
      rating: Number,
      review: String,
      ratedAt: Date,
    },
    ownerRating: {
      rating: Number,
      review: String,
      ratedAt: Date,
    },
  },
  { timestamps: true }
);

bookingSchema.index({ shipperId: 1, status: 1 });
bookingSchema.index({ ownerId: 1, status: 1 });
bookingSchema.index({ driverId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
