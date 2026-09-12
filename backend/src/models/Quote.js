const mongoose = require('mongoose');

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
      enum: ['pending', 'accepted', 'rejected', 'countered'],
      default: 'pending',
    },

    counterOfferPrice: Number,
    counterOfferBy: {
      type: String,
      enum: ['shipper', 'owner'],
    },
    counterOfferedAt: Date,

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

module.exports = mongoose.model('Quote', quoteSchema);
