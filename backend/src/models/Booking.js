const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/banks');

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
    // The truck agreed in the negotiation. Bookings made before trucks were
    // part of an offer have none.
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
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

    // How the last confirmed payment was made.
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
    },
    // pending until money is confirmed, partial while some is still due,
    // completed once confirmed payments reach the total.
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'completed'],
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
    locationUpdatedAt: Date,

    deliveryPhotos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // Not private like KYC documents. This is operational proof the driver
    // and recipient can both point back to, same tier as delivery photos.
    deliverySignature: {
      url: String,
      publicId: String,
      capturedAt: Date,
    },

    // When the driver marked the trip delivered.
    completedAt: Date,
    // The owner's invoice to the shipper, numbered when the trip is completed
    // ("FL/2083-84/00042", running per Nepali fiscal year). See services/invoice.
    invoice: {
      number: String,
      issuedAt: Date,
    },

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
// A truck's or a load's bookings, for their admin pages.
bookingSchema.index({ truckId: 1, createdAt: -1 });
bookingSchema.index({ loadId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
