const mongoose = require('mongoose');
const payoutMethodSchema = require('./schemas/payoutMethod');

// Settings for FLITO itself, kept as a single document. For now that is
// where truck owners pay FLITO's fees: the bank accounts and eSewa/Khalti
// wallets an admin adds, each with its official QR.
const KEY = 'platform';

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: KEY, unique: true },
    payoutMethods: [payoutMethodSchema],
  },
  { timestamps: true }
);

// The settings document, created empty the first time it is needed.
platformSettingsSchema.statics.current = function current() {
  return this.findOneAndUpdate({ key: KEY }, { $setOnInsert: { key: KEY } }, { upsert: true, new: true });
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
