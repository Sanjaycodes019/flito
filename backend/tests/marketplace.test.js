const mongoose = require('mongoose');
const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const Load = () => mongoose.model('Load');
const Quote = () => mongoose.model('Quote');
const User = () => mongoose.model('User');

const postLoad = async (shipper) =>
  (await as(shipper.token).post('/api/loads').send({
    goodsType: 'Cement',
    pickupLocation: { address: 'Kathmandu' },
    dropoffLocation: { address: 'Pokhara' },
  }).expect(201)).body.load;

const quoteOn = (owner, load, quotedPrice = 15000) =>
  as(owner.token).post('/api/quotes').send({ loadId: load._id, quotedPrice });

const newUser = (role, firstName = 'Test') => signUp({ phone: uniquePhone(), role, firstName });

describe('competitive bidding', () => {
  // Bug: browse listed only "open" loads, and the first quote flips a load to
  // "quoted" — so it vanished for every other owner after one bid.
  it('keeps a load visible to other owners after the first quote', async () => {
    const shipper = await newUser('shipper');
    const ownerA = await newUser('owner');
    const ownerB = await newUser('owner');
    const load = await postLoad(shipper);

    await quoteOn(ownerA, load).expect(201);

    const browse = await as(ownerB.token).get('/api/loads').expect(200);
    expect(browse.body.loads.map((l) => l._id)).toContain(load._id);
    await quoteOn(ownerB, load, 14000).expect(201);
  });

  it('allows only one active quote per owner per load', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);

    await quoteOn(owner, load).expect(201);
    const res = await quoteOn(owner, load, 9000);
    expect(res.status).toBe(409);

    expect((await Load().findById(load._id)).totalQuotes).toBe(1);
  });
});

describe('booking a load exactly once', () => {
  // Bug: accepting never checked the load was still bookable, and competing
  // quotes stayed "pending" — so a second accept created a second booking.
  it('refuses a second acceptance on an already-booked load', async () => {
    const shipper = await newUser('shipper');
    const ownerA = await newUser('owner');
    const ownerB = await newUser('owner');
    const load = await postLoad(shipper);
    const quoteA = (await quoteOn(ownerA, load).expect(201)).body.quote;
    const quoteB = (await quoteOn(ownerB, load, 14000).expect(201)).body.quote;

    await as(shipper.token).patch(`/api/quotes/${quoteA._id}/accept`).expect(200);
    const second = await as(shipper.token).patch(`/api/quotes/${quoteB._id}/accept`);

    expect(second.status).toBe(400);
    expect(await mongoose.model('Booking').countDocuments({ loadId: load._id })).toBe(1);
  });

  it('rejects the competing quotes when one is accepted', async () => {
    const shipper = await newUser('shipper');
    const ownerA = await newUser('owner');
    const ownerB = await newUser('owner');
    const load = await postLoad(shipper);
    const quoteA = (await quoteOn(ownerA, load).expect(201)).body.quote;
    const quoteB = (await quoteOn(ownerB, load, 14000).expect(201)).body.quote;

    await as(shipper.token).patch(`/api/quotes/${quoteA._id}/accept`).expect(200);

    expect((await Quote().findById(quoteB._id)).status).toBe('rejected');
  });

  // Concurrency: two accepts racing on the same load must not both win.
  it('lets only one of two simultaneous acceptances succeed', async () => {
    const shipper = await newUser('shipper');
    const ownerA = await newUser('owner');
    const ownerB = await newUser('owner');
    const load = await postLoad(shipper);
    const quoteA = (await quoteOn(ownerA, load).expect(201)).body.quote;
    const quoteB = (await quoteOn(ownerB, load, 14000).expect(201)).body.quote;

    const results = await Promise.all([
      as(shipper.token).patch(`/api/quotes/${quoteA._id}/accept`),
      as(shipper.token).patch(`/api/quotes/${quoteB._id}/accept`),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(await mongoose.model('Booking').countDocuments({ loadId: load._id })).toBe(1);
  });
});

describe('closed quotes are immutable', () => {
  const acceptedQuote = async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    const quote = (await quoteOn(owner, load).expect(201)).body.quote;
    await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);
    return { shipper, owner, load, quote };
  };

  // Bug: counter didn't check status, so countering an accepted quote flipped
  // a booked load back to "negotiating".
  it('refuses a counter-offer on an accepted quote', async () => {
    const { owner, load, quote } = await acceptedQuote();

    const res = await as(owner.token).patch(`/api/quotes/${quote._id}/counter`)
      .send({ counterOfferPrice: 20000 });

    expect(res.status).toBe(400);
    expect((await Load().findById(load._id)).status).toBe('booked');
  });

  it('refuses to reject an accepted quote', async () => {
    const { owner, quote } = await acceptedQuote();

    const res = await as(owner.token).patch(`/api/quotes/${quote._id}/reject`);

    expect(res.status).toBe(400);
    expect((await Quote().findById(quote._id)).status).toBe('accepted');
  });
});

describe('ratings', () => {
  const completedBooking = async () => {
    const shipper = await newUser('shipper', 'Ram');
    const owner = await newUser('owner', 'Bikash');
    const driver = await newUser('driver', 'Hari');
    const load = await postLoad(shipper);
    const quote = (await quoteOn(owner, load).expect(201)).body.quote;
    const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
    await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver.id }).expect(200);
    await as(driver.token).patch(`/api/bookings/${booking._id}/status`)
      .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);
    return { shipper, owner, booking };
  };

  // Bug: ratings were saved on the booking but never rolled up, so every
  // user's rating stayed 0 forever.
  it('updates the rated owner\'s average rating', async () => {
    const { shipper, owner, booking } = await completedBooking();

    await as(shipper.token).post(`/api/bookings/${booking._id}/rate`).send({ rating: 4 }).expect(200);

    const rated = await User().findById(owner.id);
    expect(rated.rating).toBe(4);
    expect(rated.totalRatings).toBe(1);
  });

  it('averages across multiple bookings', async () => {
    const first = await completedBooking();
    await as(first.shipper.token).post(`/api/bookings/${first.booking._id}/rate`).send({ rating: 5 }).expect(200);

    // A second completed booking for the same owner.
    const shipper2 = await newUser('shipper');
    const driver2 = await newUser('driver');
    const load2 = await postLoad(shipper2);
    const quote2 = (await quoteOn(first.owner, load2).expect(201)).body.quote;
    const booking2 = (await as(shipper2.token).patch(`/api/quotes/${quote2._id}/accept`).expect(200)).body.booking;
    await as(first.owner.token).patch(`/api/bookings/${booking2._id}/assign-driver`).send({ driverId: driver2.id }).expect(200);
    await as(driver2.token).patch(`/api/bookings/${booking2._id}/status`)
      .send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);
    await as(shipper2.token).post(`/api/bookings/${booking2._id}/rate`).send({ rating: 2 }).expect(200);

    const rated = await User().findById(first.owner.id);
    expect(rated.rating).toBe(3.5);
    expect(rated.totalRatings).toBe(2);
  });

  it('does not let the same party rate a booking twice', async () => {
    const { shipper, owner, booking } = await completedBooking();

    await as(shipper.token).post(`/api/bookings/${booking._id}/rate`).send({ rating: 5 }).expect(200);
    const again = await as(shipper.token).post(`/api/bookings/${booking._id}/rate`).send({ rating: 1 });

    expect(again.status).toBe(400);
    const rated = await User().findById(owner.id);
    expect(rated.rating).toBe(5);
    expect(rated.totalRatings).toBe(1);
  });

  it.each([0, 6, 3.5, 'great', undefined])('rejects an invalid rating value: %p', async (rating) => {
    const { shipper, booking } = await completedBooking();
    const res = await as(shipper.token).post(`/api/bookings/${booking._id}/rate`).send({ rating });
    expect(res.status).toBe(400);
  });
});

describe('expiry', () => {
  const { expireStale } = require('../src/services/expiry');

  const backdate = (model, id) =>
    model.updateOne({ _id: id }, { expiresAt: new Date(Date.now() - 60 * 1000) });

  it('hides an expired load from browse and refuses new quotes', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    await backdate(Load(), load._id);

    const browse = await as(owner.token).get('/api/loads').expect(200);
    expect(browse.body.loads.map((l) => l._id)).not.toContain(load._id);

    const res = await quoteOn(owner, load);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('marks stale loads and quotes as expired in a sweep', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    const quote = (await quoteOn(owner, load).expect(201)).body.quote;
    await backdate(Load(), load._id);
    await backdate(Quote(), quote._id);

    const result = await expireStale();

    expect(result).toEqual({ loads: 1, quotes: 1 });
    expect((await Load().findById(load._id)).status).toBe('expired');
    expect((await Quote().findById(quote._id)).status).toBe('expired');
  });

  it('leaves booked loads alone even when past their expiry', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    const quote = (await quoteOn(owner, load).expect(201)).body.quote;
    await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);
    await backdate(Load(), load._id);

    await expireStale();

    expect((await Load().findById(load._id)).status).toBe('booked');
  });

  it('refuses to accept an expired quote', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    const quote = (await quoteOn(owner, load).expect(201)).body.quote;
    await backdate(Quote(), quote._id);

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('lets the shipper relist an expired load', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    await backdate(Load(), load._id);
    await expireStale();

    const res = await as(shipper.token).patch(`/api/loads/${load._id}/relist`).expect(200);

    expect(res.body.load.status).toBe('open');
    expect(new Date(res.body.load.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await quoteOn(owner, load).expect(201);
  });

  it('stops anyone but the shipper relisting', async () => {
    const shipper = await newUser('shipper');
    const otherShipper = await newUser('shipper');
    const load = await postLoad(shipper);
    await backdate(Load(), load._id);
    await expireStale();

    const res = await as(otherShipper.token).patch(`/api/loads/${load._id}/relist`);
    expect(res.status).toBe(403);
  });
});
