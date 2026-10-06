const mongoose = require('mongoose');
const { BANK_CODES, PAYOUT_KINDS } = require('../../config/banks');

// One bank account or eSewa/Khalti wallet that money can be paid into: an
// owner's (users' payoutMethods) or FLITO's own (PlatformSettings).
const payoutMethodSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: PAYOUT_KINDS, required: true },
    // Banks only: a code from config/banks, and the name typed in for "other".
    bankCode: { type: String, enum: BANK_CODES },
    bankName: String,
    branch: String,
    accountNumber: String,
    // The name on the account or wallet, so the payer can check it before paying.
    accountName: { type: String, required: true },
    // eSewa or Khalti: the wallet's mobile number.
    walletId: String,
    // A photo of the bank's or wallet's payment QR, in public storage.
    qr: { url: String, publicId: String },
    // The one shown first to whoever is paying.
    primary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = payoutMethodSchema;
