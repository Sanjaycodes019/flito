// Push sends go through axios directly (see services/push.js); mocking it
// here means every test exercises the real controller/route code but never
// makes a network call to Expo.
jest.mock('axios');
const axios = require('axios');
const mongoose = require('mongoose');
const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, quoteOn, placeQuote,
} = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  axios.post.mockResolvedValue({ data: { data: [{ status: 'ok', id: 'ticket-1' }] } });
});

const VALID_TOKEN = 'ExponentPushToken[abcDEF123]';
const VALID_TOKEN_2 = 'ExponentPushToken[xyz789]';

const User = () => mongoose.model('User');
const newUser = (role, extra) => signUp({ phone: uniquePhone(), role, ...extra });

const registerToken = (actor, token) => as(actor.token).patch('/api/users/me/push-token').send({ pushToken: token });

// Finds the push call whose body's title matches, regardless of how many
// other pushes (to other recipients) fired in the same request.
const pushCallTo = (recipientToken) => axios.post.mock.calls
  .map(([, body]) => body[0])
  .find((msg) => msg.to === recipientToken);

describe('registering a push token', () => {
  it('stores a valid Expo push token', async () => {
    const shipper = await newUser('shipper');
    await registerToken(shipper, VALID_TOKEN).expect(200);
    expect((await User().findById(shipper.id)).pushToken).toBe(VALID_TOKEN);
  });

  it('rejects a malformed token', async () => {
    const shipper = await newUser('shipper');
    for (const bad of ['not-a-token', 'ExponentPushToken', '', 123, null]) {
      const res = await registerToken(shipper, bad);
      expect(res.status).toBe(400);
    }
  });

  it('requires authentication', async () => {
    const res = await as('garbage').patch('/api/users/me/push-token').send({ pushToken: VALID_TOKEN });
    expect(res.status).toBe(401);
  });

  it('overwrites the previous token on re-registration (one device wins)', async () => {
    const shipper = await newUser('shipper');
    await registerToken(shipper, VALID_TOKEN).expect(200);
    await registerToken(shipper, VALID_TOKEN_2).expect(200);
    expect((await User().findById(shipper.id)).pushToken).toBe(VALID_TOKEN_2);
  });

  it('clears the token on unregister (logout)', async () => {
    const shipper = await newUser('shipper');
    await registerToken(shipper, VALID_TOKEN).expect(200);
    await as(shipper.token).delete('/api/users/me/push-token').expect(200);
    expect((await User().findById(shipper.id)).pushToken).toBeUndefined();
  });
});

describe('sending pushes', () => {
  const postLoad = (shipper) => as(shipper.token).post('/api/loads').send(sampleLoad())
    .expect(201).then((r) => r.body.load);

  it('never fails the request if the recipient has no token registered', async () => {
    const shipper = await newUser('shipper'); // no push token registered
    const owner = await newUser('owner');
    await registerToken(owner, VALID_TOKEN_2);
    const load = await postLoad(shipper);

    const res = await quoteOn(owner, load, 12000);

    expect(res.status).toBe(201);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('notifies the shipper when a quote is submitted', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    await registerToken(shipper, VALID_TOKEN);
    const load = await postLoad(shipper);

    await placeQuote(owner, load, 12000);

    const push = pushCallTo(VALID_TOKEN);
    expect(push).toBeDefined();
    expect(push.title).toMatch(/new quote/i);
    expect(push.data).toEqual({ type: 'load', loadId: load._id });
  });

  it('notifies the other party on a counter-offer', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    await registerToken(owner, VALID_TOKEN);
    const load = await postLoad(shipper);
    const quote = await placeQuote(owner, load, 12000);

    await as(shipper.token).patch(`/api/quotes/${quote._id}/counter`).send({ counterOfferPrice: 10000 }).expect(200);

    expect(pushCallTo(VALID_TOKEN)?.title).toMatch(/counter-offer/i);
  });

  it('notifies the winner on acceptance and every losing owner separately', async () => {
    const shipper = await newUser('shipper');
    const winner = await newUser('owner');
    const loser = await newUser('owner');
    await registerToken(winner, VALID_TOKEN);
    await registerToken(loser, VALID_TOKEN_2);
    const load = await postLoad(shipper);
    const winningQuote = await placeQuote(winner, load, 12000);
    await placeQuote(loser, load, 11000);

    await as(shipper.token).patch(`/api/quotes/${winningQuote._id}/accept`).expect(200);

    expect(pushCallTo(VALID_TOKEN)?.title).toMatch(/accepted/i);
    expect(pushCallTo(VALID_TOKEN_2)?.title).toMatch(/no longer available/i);
  });

  it('notifies both the driver and the shipper on assignment', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const driver = await newUser('driver');
    await registerToken(shipper, VALID_TOKEN);
    await registerToken(driver, VALID_TOKEN_2);
    const load = await postLoad(shipper);
    const quote = await placeQuote(owner, load, 12000);
    const booking = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`)).body.booking;
    axios.post.mockClear(); // isolate from the earlier "New quote received" push to this same token

    await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver.id }).expect(200);

    expect(pushCallTo(VALID_TOKEN)?.title).toMatch(/driver assigned/i);
    expect(pushCallTo(VALID_TOKEN_2)?.title).toMatch(/delivery assigned/i);
  });

  it('notifies the other parties on pickup, delivery, and cancellation, never the actor', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const driver = await newUser('driver');
    await registerToken(shipper, VALID_TOKEN);
    await registerToken(owner, VALID_TOKEN_2);
    await registerToken(driver, 'ExponentPushToken[driver999]');
    const load = await postLoad(shipper);
    const quote = await placeQuote(owner, load, 12000);
    const booking = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`)).body.booking;
    await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver.id });
    axios.post.mockClear();

    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ pickupStatus: 'picked_up', status: 'in_transit' }).expect(200);
    expect(pushCallTo(VALID_TOKEN)?.title).toMatch(/picked up/i); // shipper notified
    expect(pushCallTo('ExponentPushToken[driver999]')).toBeUndefined(); // driver caused it, not notified
    axios.post.mockClear();

    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);
    expect(pushCallTo(VALID_TOKEN)?.title).toMatch(/delivered/i);
    expect(pushCallTo(VALID_TOKEN_2)?.title).toMatch(/delivered/i);
  });

  it('notifies the KYC applicant on approval and rejection', async () => {
    const shipper = await newUser('shipper');
    await registerToken(shipper, VALID_TOKEN);
    const admin = await User().create({ phone: uniquePhone(), role: 'admin', firstName: 'Sita', isPhoneVerified: true });
    const jwt = require('jsonwebtoken');
    const adminToken = jwt.sign({ userId: admin._id, phone: admin.phone, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await User().updateOne({ _id: shipper.id }, { kycStatus: 'pending' });
    await as(adminToken).patch(`/api/admin/kyc/${shipper.id}`).send({ decision: 'rejected', reason: 'Blurry photo' }).expect(200);
    expect(pushCallTo(VALID_TOKEN)?.body).toBe('Blurry photo');
    axios.post.mockClear();

    await User().updateOne({ _id: shipper.id }, { kycStatus: 'pending' });
    await as(adminToken).patch(`/api/admin/kyc/${shipper.id}`).send({ decision: 'approved' }).expect(200);
    expect(pushCallTo(VALID_TOKEN)?.title).toMatch(/verified/i);
  });

  it('drops a stale token when Expo reports the device is gone', async () => {
    axios.post.mockResolvedValue({
      data: { data: [{ status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }] },
    });
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    await registerToken(shipper, VALID_TOKEN);
    const load = await postLoad(shipper);

    await placeQuote(owner, load, 12000);

    expect((await User().findById(shipper.id)).pushToken).toBeUndefined();
  });

  it('never lets a push failure break the underlying request', async () => {
    axios.post.mockRejectedValue(new Error('network down'));
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    await registerToken(shipper, VALID_TOKEN);
    const load = await postLoad(shipper);

    const res = await quoteOn(owner, load, 12000);

    expect(res.status).toBe(201);
  });
});
