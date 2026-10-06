const mongoose = require('mongoose');

// FLITO's fee on one completed trip (one truck's booking), owed by the truck
// owner and billed with the rest of that Nepali month's trips. Created once,
// when the driver marks the delivery done; the fare and rate are kept as they
// were, so a later change to the rates never changes an old bill.
const commissionChargeSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    loadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Load' },
    fare: { type: Number, required: true },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },
    // One of the owner's first free trips: kept at no fee, and counted, so
    // the owner can see which trips were free.
    welcome: { type: Boolean, default: false },
    // The Nepal day the trip was completed ("2026-10-05") and its BS month
    // ("2083-06"), the month it is billed in.
    completedDay: { type: String, required: true },
    period: { type: String, required: true },
  },
  { timestamps: true }
);

commissionChargeSchema.index({ ownerId: 1, period: 1 });

module.exports = mongoose.model('CommissionCharge', commissionChargeSchema);
