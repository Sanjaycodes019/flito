const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    truckType: {
      type: String,
      enum: ['18-wheeler', '14-ton', '10-ton', 'other'],
      required: true,
    },
    capacity: Number, // in kg
    makeModel: String,
    year: Number,

    // A truck's regular driver. Per-booking assignment still happens on the
    // booking itself, so this is a default, not a hard binding.
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active',
    },

    documents: [
      {
        type: { type: String }, // bluebook, insurance, permit
        url: String,
        expiresAt: Date,
      },
    ],
  },
  { timestamps: true }
);

// Registration numbers are unique per owner, not globally. Two owners should
// never be blocked by each other, but one owner can't list the same truck twice.
truckSchema.index({ ownerId: 1, registrationNumber: 1 }, { unique: true });

module.exports = mongoose.model('Truck', truckSchema);
