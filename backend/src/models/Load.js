const mongoose = require('mongoose');

// A pickup or dropoff: a complete Nepal address from the official lists (see
// services/nepalLocations), its display text built from those lists, and an
// optional exact point and contact. Loads posted before structured addresses
// have only `address` (free text) and maybe `coordinates`.
const stopSchema = new mongoose.Schema(
  {
    provinceId: String,
    districtId: String,
    localLevelId: String,
    ward: Number,
    tole: String,
    // "Basantapur, Ward 20, Kathmandu Metropolitan City, Kathmandu, Bagmati Province"
    address: String,
    // "Basantapur, Kathmandu"
    label: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
    contactPerson: String,
    phone: String,
  },
  { _id: false }
);

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

    pickupLocation: stopSchema,
    dropoffLocation: stopSchema,

    preferredPickupDate: Date,
    // The pickup date as a Nepal calendar day ("2026-09-16"). Truck
    // availability is checked against it.
    pickupDay: String,
    // Road distance between the stops, in km, and whether it is a real
    // route or the straight-line estimate used when routing was unavailable.
    distanceKm: Number,
    distanceSource: { type: String, enum: ['route', 'estimate'] },
    // How many days the trip keeps a truck busy from the pickup day (1 for a
    // trip that fits in a day). A booking blocks the truck for all of them.
    tripDays: { type: Number, default: 1, min: 1 },
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

    // Kept with the storage public ID so removing a photo also deletes the file.
    photos: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    expiresAt: Date,
  },
  { timestamps: true }
);

loadSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Load', loadSchema);
