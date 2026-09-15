const mongoose = require('mongoose');

// A negotiation between a shipper and one truck owner over one load. Either
// side opens it: an owner quotes on the load with one of their trucks, or the
// shipper requests a truck at a price. They then take turns until one accepts
// (which books the load) or either walks away. See services/negotiation.js.
const quoteSchema = new mongoose.Schema(
  {
    loadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Load',
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The truck on offer. Quotes made before trucks were required have none.
    truckId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Truck',
    },
    initiatedBy: {
      type: String,
      enum: ['shipper', 'owner'],
      default: 'owner',
    },

    // The opening price.
    quotedPrice: {
      type: Number,
      required: true,
    },
    perKmRate: Number,
    baseCharge: Number,
    taxes: Number,

    truckType: String,
    truckCapacity: Number,
    estimatedDuration: Number, // in hours

    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'countered', 'expired'],
      default: 'pending',
    },

    // The latest counter-offer, once there is one.
    counterOfferPrice: Number,
    counterOfferBy: {
      type: String,
      enum: ['shipper', 'owner'],
    },
    counterOfferedAt: Date,

    // Every offer made, oldest first, starting with the opening price.
    offers: [
      {
        _id: false,
        by: { type: String, enum: ['shipper', 'owner'], required: true },
        price: { type: Number, required: true },
        at: { type: Date, default: Date.now },
      },
    ],

    acceptedAt: Date,
    acceptedBy: {
      type: String,
      enum: ['shipper', 'owner'],
    },

    expiresAt: Date,
  },
  { timestamps: true }
);

quoteSchema.index({ loadId: 1, status: 1 });
quoteSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('Quote', quoteSchema);
