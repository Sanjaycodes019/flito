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

module.exports = { setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone, uniqueEmail, TEST_PASSWORD };
