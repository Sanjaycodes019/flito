// One-off fix for the switch from phone+OTP to email+password/Google auth:
// `phone` used to be `required: true` with a plain unique index, so every
// existing document had one. It's now optional, and the index needs to be
// `sparse` too, or a second new account with no phone would collide with
// the first on `phone: null`. Mongoose does not alter an existing index in
// place when its options change, so this drops and recreates every index on
// User to match the current schema. Safe to re-run.
//
//   node scripts/migrateAuthIndexes.js
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
    const before = await User.collection.indexes();
    console.log('Indexes before:', before.map((i) => i.name).join(', '));

    await User.syncIndexes();

    const after = await User.collection.indexes();
    console.log('Indexes after:', after.map((i) => i.name).join(', '));
    console.log('Done. The phone index is now sparse, so multiple accounts with no phone number no longer collide.');
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
