const mongoose = require('mongoose');

const loadSchema = new mongoose.Schema(
  {
    shipperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    goodsType: {
      type: String,
      required: true,
    },
    description: String,
    weight: Number, // in kg
    volume: Number, // in cubic meters
    quantity: Number,

    pickupLocation: {
      address: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
      contactPerson: String,
      phone: String,
    },

    dropoffLocation: {
      address: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
      contactPerson: String,
      phone: String,
    },

    preferredPickupDate: Date,
    estimatedDeliveryDate: Date,
    truckTypePreference: {
      type: String,
      enum: ['18-wheeler', '14-ton', '10-ton', 'any'],
      default: 'any',
    },

    budgetEstimate: Number,
    status: {
      type: String,
      enum: ['open', 'quoted', 'negotiating', 'booked', 'completed', 'cancelled', 'expired'],
      default: 'open',
    },

    totalQuotes: {
      type: Number,
      default: 0,
    },

    photos: [String],
    expiresAt: Date,
  },
  { timestamps: true }
);

loadSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Load', loadSchema);
