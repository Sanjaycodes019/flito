const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const createApp = require('../src/app');

let mongod;

// Tests run against a real MongoDB (in-memory), not mocks, so schema
// validation, indexes and populate behave exactly as they do in production,
// the populate/ownership bug this suite guards against only reproduces with
// real documents.
const setupTestDb = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'flito_test' });
};

const teardownTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod?.stop();
};

const clearDb = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

const app = () => createApp();

// Counters keep each test's phone/email independent without a test-only
// reset hook in production code.
let phoneCounter = 0;
const uniquePhone = () => `+9779${String(800000000 + (phoneCounter += 1)).padStart(9, '0')}`;

let emailCounter = 0;
const uniqueEmail = () => `test${(emailCounter += 1)}@flito.test`;

const TEST_PASSWORD = 'TestPass123';

// Signs a user up through the real email/password flow and returns their
// token/ids, so tests exercise the same auth path the app uses. `phone` is
// optional, same as in the real signup, and is set when a test needs a real
// number to look up later (e.g. assigning a driver by phone). Accounts are
// identity-verified (KYC) by default because most suites test rules that
// assume a verified owner or driver; pass `verified: false` to test
// verification itself.
const signUp = async ({ phone, role, firstName = 'Test', lastName = 'User', verified = true }) => {
  const agent = request(app());
  const res = await agent
    .post('/api/auth/signup')
    .send({ email: uniqueEmail(), password: TEST_PASSWORD, phone, role, firstName, lastName })
    .expect(201);

  const id = res.body.user._id;
  if (verified) {
    await mongoose.model('User').updateOne({ _id: id }, { kycStatus: 'approved' });
  }

  return { token: res.body.token, user: res.body.user, id };
};

// A complete, valid address in the local level with this name.
const placeIn = (localLevelName, ward, tole) => {
  const { getTree } = require('../src/services/nepalLocations');
  const tree = getTree();
  const localLevel = tree.localLevels.find((l) => l.name === localLevelName);
  const district = tree.districts.find((d) => d.id === localLevel.districtId);
  return { provinceId: district.provinceId, districtId: district.id, localLevelId: localLevel.id, ward, tole };
};

// Basantapur, ward 20, Kathmandu Metropolitan City.
const sampleAddress = () => placeIn('Kathmandu', 20, 'Basantapur');

// A valid pickup and dropoff for posting a load: Kathmandu to Pokhara.
const loadRoute = () => ({
  pickupLocation: placeIn('Kathmandu', 20, 'Basantapur'),
  dropoffLocation: placeIn('Pokhara', 6, 'Lakeside'),
});

// A valid load to post: 6,000 kg of cement from Kathmandu to Pokhara, picked
// up today.
const sampleLoad = (overrides = {}) => ({ goodsType: 'Cement', weight: 6000, ...loadRoute(), ...overrides });

// A municipality as a truck's base.
const areaIn = (localLevelName) => {
  const { provinceId, districtId, localLevelId } = placeIn(localLevelName, 1, '-');
  return { provinceId, districtId, localLevelId };
};

let registrationCounter = 0;

// Adds a truck to an owner's fleet: by default an open-body 6-wheeler that
// carries 10,000 kg, based in Kathmandu, asking Rs. 80 per km, at least Rs. 5,000.
const addTruck = async (owner, overrides = {}) => (await request(app())
  .post('/api/trucks')
  .set('Authorization', `Bearer ${owner.token}`)
  .send({
    registrationNumber: `BA 1 KHA ${1000 + (registrationCounter += 1)}`,
    truckType: '6-wheeler',
    bodyType: 'open',
    capacity: 10000,
    baseLocation: areaIn('Kathmandu'),
    ratePerKm: 80,
    minimumCharge: 5000,
    ...overrides,
  })
  .expect(201)).body.truck;

// An owner's quote on a load with one of their trucks (a new default truck
// unless one is given). Returns the response without checking it.
const quoteOn = async (owner, load, quotedPrice = 15000, truck = null) => {
  const truckId = (truck || await addTruck(owner))._id;
  return request(app())
    .post('/api/quotes')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ loadId: load._id, quotedPrice, truckId });
};

// The same, expecting it to succeed, and returning the quote.
const placeQuote = async (owner, load, quotedPrice = 15000, truck = null) => {
  const res = await quoteOn(owner, load, quotedPrice, truck);
  if (res.status !== 201) throw new Error(`Quote failed with ${res.status}: ${res.body.message}`);
  return res.body.quote;
};

// Convenience: an authenticated supertest agent for a given token.
const as = (token) => {
  const base = request(app());
  const withAuth = (method) => (url) => base[method](url).set('Authorization', `Bearer ${token}`);
  return {
    get: withAuth('get'),
    post: withAuth('post'),
    patch: withAuth('patch'),
    delete: withAuth('delete'),
  };
};

module.exports = {
  setupTestDb,
  teardownTestDb,
  clearDb,
  app,
  signUp,
  as,
  uniquePhone,
  uniqueEmail,
  placeIn,
  areaIn,
  sampleAddress,
  loadRoute,
  sampleLoad,
  addTruck,
  quoteOn,
  placeQuote,
  TEST_PASSWORD,
};
