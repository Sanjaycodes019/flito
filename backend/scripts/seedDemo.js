// Local demo data: one account per role plus a small marketplace to click
// through. Safe to re-run — existing demo accounts and data are reused, never
// duplicated. Refuses to run with NODE_ENV=production.
//
//   npm run seed
//
// In development every account logs in with OTP 123456.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Load = require('../src/models/Load');
const Quote = require('../src/models/Quote');
const Truck = require('../src/models/Truck');
const { LOAD_TTL_MS, QUOTE_TTL_MS } = require('../src/services/expiry');

const DEMO_USERS = [
  { key: 'admin', phone: '+9779800000000', role: 'admin', firstName: 'Sita', lastName: 'Sharma', kycStatus: 'approved' },
  { key: 'shipper', phone: '+9779800000001', role: 'shipper', firstName: 'Ram', lastName: 'Shrestha' },
  { key: 'ownerA', phone: '+9779800000002', role: 'owner', firstName: 'Bikash', lastName: 'Thapa', companyName: 'Thapa Transport' },
  { key: 'ownerB', phone: '+9779800000003', role: 'owner', firstName: 'Anita', lastName: 'Gurung', companyName: 'Gurung Logistics' },
  { key: 'driver', phone: '+9779800000004', role: 'driver', firstName: 'Hari', lastName: 'Tamang' },
];

const inFuture = (ms) => new Date(Date.now() + ms);

const upsertUsers = async () => {
  const users = {};
  for (const { key, ...fields } of DEMO_USERS) {
    users[key] = await User.findOne({ phone: fields.phone })
      || await User.create({ ...fields, isPhoneVerified: true });
  }
  return users;
};

const seedMarketplace = async ({ shipper, ownerA, ownerB, driver }) => {
  if (await Load.exists({ shipperId: shipper._id })) {
    console.log('Demo loads already exist — skipping marketplace data.');
    return;
  }

  const competitive = await Load.create({
    shipperId: shipper._id,
    goodsType: 'Cement bags',
    description: '120 bags, palletised',
    weight: 6000,
    pickupLocation: { address: 'Kathmandu, Balaju', coordinates: { lat: 27.7340, lng: 85.3000 } },
    dropoffLocation: { address: 'Pokhara, Lakeside', coordinates: { lat: 28.2096, lng: 83.9596 } },
    truckTypePreference: '10-ton',
    budgetEstimate: 18000,
    status: 'quoted',
    totalQuotes: 2,
    expiresAt: inFuture(LOAD_TTL_MS),
  });

  await Quote.create([
    { loadId: competitive._id, ownerId: ownerA._id, quotedPrice: 16500, truckType: '10-ton', expiresAt: inFuture(QUOTE_TTL_MS) },
    { loadId: competitive._id, ownerId: ownerB._id, quotedPrice: 15800, truckType: '10-ton', expiresAt: inFuture(QUOTE_TTL_MS) },
  ]);

  await Load.create([
    {
      shipperId: shipper._id,
      goodsType: 'Rice sacks',
      weight: 3500,
      pickupLocation: { address: 'Butwal, Traffic Chowk', coordinates: { lat: 27.7006, lng: 83.4484 } },
      dropoffLocation: { address: 'Kathmandu, Kalimati', coordinates: { lat: 27.6980, lng: 85.2970 } },
      truckTypePreference: 'any',
      budgetEstimate: 14000,
      expiresAt: inFuture(LOAD_TTL_MS),
    },
    {
      shipperId: shipper._id,
      goodsType: 'Office furniture',
      description: 'Desks and chairs, fragile',
      pickupLocation: { address: 'Biratnagar, Main Road', coordinates: { lat: 26.4525, lng: 87.2718 } },
      dropoffLocation: { address: 'Dharan, Bhanu Chowk', coordinates: { lat: 26.8120, lng: 87.2830 } },
      truckTypePreference: '14-ton',
      expiresAt: inFuture(LOAD_TTL_MS),
    },
  ]);

  if (!await Truck.exists({ ownerId: ownerA._id })) {
    await Truck.create({
      ownerId: ownerA._id,
      registrationNumber: 'BA 2 KHA 4567',
      truckType: '10-ton',
      capacity: 10000,
      makeModel: 'Tata 1613',
      assignedDriverId: driver._id,
    });
  }

  console.log('Created 3 loads (one with competing quotes) and a truck.');
};

const main = async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed demo data with NODE_ENV=production.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const users = await upsertUsers();
    await seedMarketplace(users);

    console.log('\nDemo accounts (OTP 123456):');
    console.table(DEMO_USERS.map(({ role, firstName, lastName, phone }) => ({ role, name: `${firstName} ${lastName}`, phone })));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
