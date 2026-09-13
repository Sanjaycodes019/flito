const mongoose = require('mongoose');
const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const User = () => mongoose.model('User');

const newUser = (role, { verified }) => signUp({
  phone: uniquePhone(),
  role,
  firstName: role === 'driver' ? 'Hari' : 'Test',
  verified,
});

const setKyc = (user, kycStatus) => User().updateOne({ _id: user.id }, { kycStatus });

const postLoad = async (shipper) => (await as(shipper.token).post('/api/loads').send({
  goodsType: 'Cement',
  pickupLocation: { address: 'Kathmandu' },
  dropoffLocation: { address: 'Pokhara' },
}).expect(201)).body.load;

const quoteOn = (owner, load, quotedPrice = 15000) =>
  as(owner.token).post('/api/quotes').send({ loadId: load._id, quotedPrice });

// A booking between a verified owner and an unverified shipper.
const setupBooking = async () => {
  const shipper = await newUser('shipper', { verified: false });
  const owner = await newUser('owner', { verified: true });
  const load = await postLoad(shipper);
  const quote = (await quoteOn(owner, load).expect(201)).body.quote;
  const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
  return { shipper, owner, booking };
};

describe('what stays open without verification', () => {
  it('lets unverified accounts post and browse loads', async () => {
    const shipper = await newUser('shipper', { verified: false });
    const owner = await newUser('owner', { verified: false });

    await postLoad(shipper);
    const browse = await as(owner.token).get('/api/loads').expect(200);

    expect(browse.body.loads).toHaveLength(1);
  });

  it("doesn't require a shipper to be verified to accept a quote", async () => {
    const { booking } = await setupBooking();
    expect(booking.status).toBe('pending');
  });
});

describe('owners must be verified to make offers', () => {
  it('refuses a quote from an unverified owner', async () => {
    const shipper = await newUser('shipper', { verified: false });
    const owner = await newUser('owner', { verified: false });
    const load = await postLoad(shipper);

    const res = await quoteOn(owner, load);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('KYC_REQUIRED');
    expect(await mongoose.model('Quote').countDocuments()).toBe(0);
  });

  it('applies an approval immediately, without logging in again', async () => {
    const shipper = await newUser('shipper', { verified: false });
    const owner = await newUser('owner', { verified: false });
    const load = await postLoad(shipper);

    expect((await quoteOn(owner, load)).status).toBe(403);
    await setKyc(owner, 'approved');

    // Same token as before the approval.
    await quoteOn(owner, load).expect(201);
  });

  it('stops an unverified owner countering or accepting, but still lets them reject', async () => {
    const shipper = await newUser('shipper', { verified: false });
    const owner = await newUser('owner', { verified: true });
    const load = await postLoad(shipper);
    const quote = (await quoteOn(owner, load).expect(201)).body.quote;
    await as(shipper.token).patch(`/api/quotes/${quote._id}/counter`).send({ counterOfferPrice: 12000 }).expect(200);

    // Verification revoked after the quote was made.
    await setKyc(owner, 'rejected');

    expect((await as(owner.token).patch(`/api/quotes/${quote._id}/counter`).send({ counterOfferPrice: 13000 })).status).toBe(403);
    expect((await as(owner.token).patch(`/api/quotes/${quote._id}/accept`)).status).toBe(403);
    await as(owner.token).patch(`/api/quotes/${quote._id}/reject`).expect(200);
  });
});

describe('drivers must be verified to be assigned', () => {
  const assign = (owner, booking, driverId) =>
    as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId });

  it('refuses to assign an unverified driver, then allows it once approved', async () => {
    const { owner, booking } = await setupBooking();
    const driver = await newUser('driver', { verified: false });

    const refused = await assign(owner, booking, driver.id);
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe('DRIVER_NOT_VERIFIED');
    expect(refused.body.message).toMatch(/Hari/);

    const unchanged = await mongoose.model('Booking').findById(booking._id);
    expect(unchanged.driverId).toBeUndefined();
    expect(unchanged.status).toBe('pending');

    await setKyc(driver, 'approved');
    const res = await assign(owner, booking, driver.id).expect(200);
    expect(res.body.booking.status).toBe('confirmed');
  });

  // Regression: any id used to be accepted as the driver.
  it('only assigns real driver accounts', async () => {
    const { shipper, owner, booking } = await setupBooking();

    expect((await assign(owner, booking, shipper.id)).status).toBe(404);
    expect((await assign(owner, booking, new mongoose.Types.ObjectId())).status).toBe(404);
    expect((await assign(owner, booking, 'not-an-id')).status).toBe(400);
  });

  it("won't change the driver once the trip is under way", async () => {
    const { owner, booking } = await setupBooking();
    const driver = await newUser('driver', { verified: true });
    const replacement = await newUser('driver', { verified: true });

    await assign(owner, booking, driver.id).expect(200);
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ pickupStatus: 'picked_up', status: 'in_transit' }).expect(200);

    const res = await assign(owner, booking, replacement.id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/in transit/);
  });
});
