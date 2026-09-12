const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const createApp = require('../src/app');

let mongod;

// Tests run against a real MongoDB (in-memory), not mocks, so schema
// validation, indexes and populate behave exactly as they do in production —
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

// The OTP store is process-global by design (an in-memory Map), so clearing
// the database does not clear pending codes. Giving each test its own phone
// number keeps them independent without adding a test-only reset hook to
// production code.
let phoneCounter = 0;
const uniquePhone = () => `+9779${String(800000000 + (phoneCounter += 1)).padStart(9, '0')}`;

// Signs a user up through the real OTP flow and returns their token/ids, so
// tests exercise the same auth path the app uses.
const signUp = async ({ phone, role, firstName = 'Test', lastName = 'User' }) => {
  const agent = request(app());
  await agent.post('/api/auth/send-otp').send({ phone }).expect(200);

  const res = await agent
    .post('/api/auth/signup')
    .send({ phone, otp: '123456', role, firstName, lastName })
    .expect(201);

  return { token: res.body.token, user: res.body.user, id: res.body.user._id };
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

module.exports = { setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone };
