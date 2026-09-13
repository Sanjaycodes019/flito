// One-off fix for data created before "not_submitted" existed: every account
// defaulted to "pending", so the admin KYC queue listed users who had never
// uploaded a document. Resets exactly those accounts. Safe to re-run.
//
//   node scripts/migrateKycStatus.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const main = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const result = await User.updateMany(
      {
        kycStatus: 'pending',
        $or: [{ kycDocuments: { $exists: false } }, { kycDocuments: { $size: 0 } }],
      },
      { kycStatus: 'not_submitted' },
    );
    console.log(`Reset ${result.modifiedCount} account(s) from "pending" to "not_submitted".`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
