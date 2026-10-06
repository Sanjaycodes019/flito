const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/banks');

// A truck owner paying FLITO's fees, into one of FLITO's accounts (or in
// cash at the office). The owner records it; an admin checks FLITO's account
// and confirms it, or rejects it with a reason. Only confirmed payments reduce
// what the owner owes.
const commissionPaymentSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    // Which of FLITO's accounts it went to, copied at the time.
    paidTo: { kind: String, label: String },
    transactionId: String,
    proof: { url: String, publicId: String },
    note: String,
    status: { type: String, enum: ['reported', 'confirmed', 'rejected'], default: 'reported' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: String,
  },
  { timestamps: true }
);

commissionPaymentSchema.index({ ownerId: 1, createdAt: -1 });
commissionPaymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CommissionPayment', commissionPaymentSchema);
