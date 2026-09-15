const mongoose = require('mongoose');
const {
  ALL_TRUCK_TYPES, BODY_TYPES, FUEL_TYPES, SERVICE_AREAS, INSURANCE_TYPES,
} = require('../config/truckTypes');

const truckSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // As on the number plate and bluebook, e.g. "BA 2 KHA 1234".
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    truckType: {
      type: String,
      enum: ALL_TRUCK_TYPES,
      required: true,
    },
    bodyType: {
      type: String,
      enum: BODY_TYPES,
    },
    capacity: Number, // the most it carries, in kg

    make: String,
    model: String,
    // "Tata 1613": make and model together, for display.
    makeModel: String,
    year: Number, // of manufacture
    fuelType: {
      type: String,
      enum: FUEL_TYPES,
    },
    // Inside measurements of the cargo bed, in feet, as trucks are measured here.
    cargoBed: {
      lengthFt: Number,
      widthFt: Number,
      heightFt: Number,
    },
    features: {
      tarpaulin: Boolean,
      helper: Boolean, // a helper (khalasi) comes with the truck
      gpsTracker: Boolean,
      hillRoads: Boolean, // fit for hill and dirt roads
    },

    // The municipality where the truck is usually parked, so it ranks higher
    // for loads picked up nearby.
    baseLocation: {
      provinceId: String,
      districtId: String,
      localLevelId: String,
    },
    serviceArea: {
      type: String,
      enum: SERVICE_AREAS,
      default: 'nepal',
    },

    // The owner's own pricing. With a rate, shippers see an asking price for
    // each trip: the rate times the distance, never below the minimum charge.
    ratePerKm: Number,
    minimumCharge: Number,

    // Papers. These stay with the owner: shippers only ever learn whether the
    // insurance is current, never a number or a document.
    chassisNumber: String,
    engineNumber: String,
    bluebookRenewedUntil: Date, // vehicle tax paid until
    insurance: {
      type: { type: String, enum: INSURANCE_TYPES },
      company: String,
      policyNumber: String,
      validUntil: Date,
    },
    emissionTestValidUntil: Date, // pollution test (green sticker)

    // A truck's regular driver. A booking made with this truck starts with
    // this driver, and the owner can still change it before the trip starts.
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active',
    },

    // Nepal days ("2026-09-16") the truck is booked for. A booking adds its
    // pickup day with a conditional update, so one truck is never booked
    // twice for the same day; cancelling or completing it removes the day.
    reservedDays: {
      type: [String],
      default: [],
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
truckSchema.index({ status: 1, capacity: 1 });

module.exports = mongoose.model('Truck', truckSchema);
