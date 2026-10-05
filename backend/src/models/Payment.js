const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/banks');

// One payment towards a booking. FLITO doesn't move the money: the shipper
// pays the owner straight into the owner's bank, eSewa or Khalti (or in cash),
// and this records it. A payment the shipper reports waits for the owner to
// confirm it arrived; one the owner records is already confirmed.
//
//   reported   the shipper says they paid, the owner hasn't confirmed yet
//   completed  the owner confirmed the money arrived (or recorded it)
//   disputed   the owner says it never arrived
//
// initiated, failed and refunded are kept for a payment gateway later.

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    payerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    payeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    amount: {
      type: Number,
      required: true,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    status: {
      type: String,
      enum: ['reported', 'completed', 'disputed', 'initiated', 'failed', 'refunded'],
      default: 'reported',
    },
    // Who entered it: the shipper reporting a payment, or the owner recording one.
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Which of the owner's accounts it went to, copied at the time so the
    // record still reads right if the owner later changes their details.
    paidTo: {
      kind: String,
      label: String,
    },
    transactionId: String, // the bank's, eSewa's or Khalti's reference
    // A screenshot of the transfer, in public storage.
    proof: { url: String, publicId: String },
    note: String,
    confirmedAt: Date,
    disputedAt: Date,
    disputeReason: String,
    gatewayResponse: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

paymentSchema.index({ bookingId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
