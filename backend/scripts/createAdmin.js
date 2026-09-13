// Create an admin account, or promote an existing one. Public signup cannot
// create admins, so this is the only way to get one.
//
//   npm run create-admin -- +9779800000000 Sita Sharma
//
// Then log in with that phone number on the normal login screen.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const PHONE_REGEX = /^\+977\d{10}$/;

const main = async () => {
  const [phone, firstName = 'Admin', lastName = ''] = process.argv.slice(2);

  if (!phone || !PHONE_REGEX.test(phone)) {
    console.error('Usage: npm run create-admin -- +977XXXXXXXXXX [FirstName] [LastName]');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const existing = await User.findOne({ phone });

    if (!existing) {
      await User.create({
        phone,
        role: 'admin',
        firstName,
        lastName,
        isPhoneVerified: true,
        kycStatus: 'approved',
      });
      console.log(`Created admin ${firstName} ${lastName} (${phone}).`);
    } else if (existing.role === 'admin') {
      console.log(`${phone} is already an admin.`);
    } else {
      // Changing role replaces what this account can see and do in the app.
      const previousRole = existing.role;
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted ${phone} from ${previousRole} to admin (it no longer has ${previousRole} screens).`);
    }

    console.log('Log in with this number on the normal login screen.');
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
