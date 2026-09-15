// Local demo data: one account per role plus a small marketplace to click
// through. Safe to re-run. Existing demo accounts and data are reused, never
// duplicated. Refuses to run with NODE_ENV=production.
//
//   npm run seed
//
// Every account logs in with email + DEMO_PASSWORD below. Phone is also set
// (and left un-random) so the owner-assigns-driver-by-phone flow has a real
// number to look up in a demo.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Load = require('../src/models/Load');
const Quote = require('../src/models/Quote');
const Truck = require('../src/models/Truck');
const { QUOTE_TTL_MS, loadExpiresAt } = require('../src/services/expiry');
const { getTree, describeAddress, estimateRoadKm } = require('../src/services/nepalLocations');
const { nepalDay, startOfNepalDay } = require('../src/services/nepalTime');

const DEMO_PASSWORD = 'Demo1234';

// A load's pickup or dropoff in the local level with this name, stored the
// same way the API stores one.
const stop = (localLevelName, ward, tole, coordinates) => {
  const tree = getTree();
  const localLevel = tree.localLevels.find((l) => l.name === localLevelName);
  const district = tree.districts.find((d) => d.id === localLevel.districtId);
  const place = { provinceId: district.provinceId, districtId: district.id, localLevelId: localLevel.id, ward, tole };
  const { formatted, label } = describeAddress(place);
  return { ...place, address: formatted, label, coordinates };
};

// A municipality as a truck's base.
const area = (localLevelName) => {
  const { provinceId, districtId, localLevelId } = stop(localLevelName, 1, '-');
  return { provinceId, districtId, localLevelId };
};

const DEMO_USERS = [
  { key: 'admin', email: 'admin@flito.demo', phone: '+9779800000000', role: 'admin', firstName: 'Sita', lastName: 'Sharma', kycStatus: 'approved', emailVerified: true },
  { key: 'shipper', email: 'shipper@flito.demo', phone: '+9779800000001', role: 'shipper', firstName: 'Ram', lastName: 'Shrestha', emailVerified: true },
  // Owners and the driver start verified, so their trucks show up as matches in a demo.
  { key: 'ownerA', email: 'owner1@flito.demo', phone: '+9779800000002', role: 'owner', firstName: 'Bikash', lastName: 'Thapa', companyName: 'Thapa Transport', kycStatus: 'approved', emailVerified: true },
  { key: 'ownerB', email: 'owner2@flito.demo', phone: '+9779800000003', role: 'owner', firstName: 'Anita', lastName: 'Gurung', companyName: 'Gurung Logistics', kycStatus: 'approved', emailVerified: true },
  { key: 'driver', email: 'driver@flito.demo', phone: '+9779800000004', role: 'driver', firstName: 'Hari', lastName: 'Tamang', kycStatus: 'approved', emailVerified: true },
];

const inFuture = (ms) => new Date(Date.now() + ms);

const upsertUsers = async () => {
  const users = {};
  for (const { key, ...fields } of DEMO_USERS) {
    let user = await User.findOne({ email: fields.email });

    if (!user) {
      // A demo account seeded back when login was phone + OTP has the phone
      // but no email or password, so it could never sign in now. Give it
      // the email/password instead of creating a duplicate that would
      // collide on the phone number.
      user = await User.findOne({ phone: fields.phone }).select('+password');
      if (user) {
        user.email = fields.email;
        user.password = DEMO_PASSWORD;
        user.emailVerified = true;
        await user.save();
      }
    }

    users[key] = user || await User.create({ ...fields, password: DEMO_PASSWORD });
  }
  return users;
};

const seedMarketplace = async ({ shipper, ownerA, ownerB, driver }) => {
  if (await Load.exists({ shipperId: shipper._id })) {
    console.log('Demo loads already exist, skipping marketplace data.');
    return;
  }

  // Trucks first, so the loads have matches. Upserted, so re-running never
  // collides with a truck left from an earlier seed.
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const fleet = [
    {
      ownerId: ownerA._id, registrationNumber: 'BA 2 KHA 4567', truckType: '6-wheeler', bodyType: 'open', capacity: 10000,
      make: 'Tata', model: '1613', makeModel: 'Tata 1613', year: 2019, fuelType: 'diesel',
      cargoBed: { lengthFt: 19, widthFt: 7.5, heightFt: 5 }, features: { tarpaulin: true, helper: true, gpsTracker: false, hillRoads: true },
      baseLocation: area('Kathmandu'), serviceArea: 'nepal', ratePerKm: 85, minimumCharge: 6000,
      insurance: { type: 'comprehensive', company: 'Shikhar Insurance', validUntil: nextYear }, bluebookRenewedUntil: nextYear,
      assignedDriverId: driver._id,
    },
    {
      ownerId: ownerB._id, registrationNumber: 'BA 3 KHA 7788', truckType: '6-wheeler', bodyType: 'covered', capacity: 9000,
      make: 'Ashok Leyland', model: '1616', makeModel: 'Ashok Leyland 1616', year: 2021, fuelType: 'diesel',
      cargoBed: { lengthFt: 20, widthFt: 7.5, heightFt: 7 }, features: { tarpaulin: false, helper: true, gpsTracker: true, hillRoads: false },
      baseLocation: area('Lalitpur'), serviceArea: 'nepal', ratePerKm: 70, minimumCharge: 4000,
      insurance: { type: 'third-party', company: 'Nepal Insurance', validUntil: nextYear },
    },
    {
      ownerId: ownerB._id, registrationNumber: 'LU 1 KHA 2211', truckType: '10-wheeler', bodyType: 'open', capacity: 18000,
      make: 'Tata', model: '2518', makeModel: 'Tata 2518', year: 2018, fuelType: 'diesel',
      features: { tarpaulin: true, helper: true, gpsTracker: false, hillRoads: false },
      baseLocation: area('Butwal'), serviceArea: 'province', ratePerKm: 110, minimumCharge: 8000,
    },
  ];
  const [truckA, truckB] = await Promise.all(fleet.map(({ ownerId, registrationNumber, ...fields }) => Truck.findOneAndUpdate(
    { ownerId, registrationNumber },
    { $set: fields },
    { upsert: true, new: true },
  )));

  const today = nepalDay();
  const route = (pickupLocation, dropoffLocation) => ({
    pickupLocation,
    dropoffLocation,
    pickupDay: today,
    preferredPickupDate: startOfNepalDay(today),
    distanceKm: estimateRoadKm(pickupLocation, dropoffLocation),
    expiresAt: loadExpiresAt(today),
  });

  const competitive = await Load.create({
    shipperId: shipper._id,
    goodsType: 'Cement bags',
    description: '120 bags, palletised',
    weight: 6000,
    ...route(
      stop('Kathmandu', 16, 'Balaju', { lat: 27.7340, lng: 85.3000 }),
      stop('Pokhara', 6, 'Lakeside', { lat: 28.2096, lng: 83.9596 }),
    ),
    status: 'quoted',
    totalQuotes: 2,
  });

  await Quote.create([
    { loadId: competitive._id, ownerId: ownerA._id, truckId: truckA._id, truckType: '6-wheeler', truckCapacity: 10000, initiatedBy: 'owner', quotedPrice: 16500, offers: [{ by: 'owner', price: 16500 }], expiresAt: inFuture(QUOTE_TTL_MS) },
    { loadId: competitive._id, ownerId: ownerB._id, truckId: truckB._id, truckType: '6-wheeler', truckCapacity: 9000, initiatedBy: 'owner', quotedPrice: 15800, offers: [{ by: 'owner', price: 15800 }], expiresAt: inFuture(QUOTE_TTL_MS) },
  ]);

  await Load.create([
    {
      shipperId: shipper._id,
      goodsType: 'Rice sacks',
      weight: 3500,
      ...route(
        stop('Butwal', 11, 'Traffic Chowk', { lat: 27.7006, lng: 83.4484 }),
        stop('Kathmandu', 13, 'Kalimati', { lat: 27.6980, lng: 85.2970 }),
      ),
    },
    {
      shipperId: shipper._id,
      goodsType: 'Office furniture',
      description: 'Desks and chairs, fragile',
      weight: 2000,
      ...route(
        stop('Biratnagar', 4, 'Main Road', { lat: 26.4525, lng: 87.2718 }),
        stop('Dharan', 8, 'Bhanu Chowk', { lat: 26.8120, lng: 87.2830 }),
      ),
    },
  ]);

  console.log('Created 3 trucks and 3 loads (one with competing quotes).');
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

    console.log(`\nDemo accounts (password: ${DEMO_PASSWORD}):`);
    console.table(DEMO_USERS.map(({ role, firstName, lastName, email, phone }) => ({ role, name: `${firstName} ${lastName}`, email, phone })));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
