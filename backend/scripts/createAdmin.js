// Create an admin account, or promote an existing one by email. Public
// signup cannot create admins, so this is the only way to get one.
//
//   npm run create-admin -- admin@example.com SomePassword123 Sita Sharma
//
// Then log in with that email and password on the normal login screen. If an
// account with that email already exists, the password argument is ignored
// and only its role is changed.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const main = async () => {
  const [email, password, firstName = 'Admin', lastName = ''] = process.argv.slice(2);

  if (!email || !EMAIL_REGEX.test(email)) {
    console.error('Usage: npm run create-admin -- email@example.com Password123 [FirstName] [LastName]');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const existing = await User.findOne({ email: email.toLowerCase() });

    if (!existing) {
      if (!password || password.length < 8) {
        console.error('A new account needs a password of at least 8 characters as the second argument.');
        process.exit(1);
      }
      await User.create({
        email: email.toLowerCase(),
        password,
        role: 'admin',
        firstName,
        lastName,
        emailVerified: true,
        kycStatus: 'approved',
      });
      console.log(`Created admin ${firstName} ${lastName} (${email}).`);
    } else if (existing.role === 'admin') {
      console.log(`${email} is already an admin.`);
    } else {
      // Changing role replaces what this account can see and do in the app.
      const previousRole = existing.role;
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted ${email} from ${previousRole} to admin (it no longer has ${previousRole} screens).`);
    }

    console.log('Log in with this email on the normal login screen.');
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
