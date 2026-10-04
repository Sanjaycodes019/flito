const mongoose = require('mongoose');
const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, addTruck, placeQuote,
} = require('./helpers');
const { expireStale } = require('../src/services/expiry');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const Load = () => mongoose.model('Load');
const Quote = () => mongoose.model('Quote');

const newUser = (role) => signUp({ phone: uniquePhone(), role });

// 30 tonnes on three trucks: each truck carries 10 tonnes.
const postLoad = async (shipper, overrides = {}) =>
  (await as(shipper.token).post('/api/loads').send(sampleLoad({ weight: 30000, trucksNeeded: 3, ...overrides })).expect(201)).body.load;

const accept = (actor, quote) => as(actor.token).patch(`/api/quotes/${quote._id}/accept`);
const apply = (owner, load, trucks, quotedPrice = 15000) =>
  as(owner.token).post('/api/quotes').send({ loadId: load._id, quotedPrice, truckIds: trucks.map((truck) => truck._id) });

describe('posting a load that needs several trucks', () => {
  it('records how many trucks it needs, one by default', async () => {
    const shipper = await newUser('shipper');
    expect(await postLoad(shipper)).toMatchObject({ trucksNeeded: 3, trucksBooked: 0 });

    const single = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;
    expect(single).toMatchObject({ trucksNeeded: 1, trucksBooked: 0 });
  });

  it('takes 1 to 10 trucks, and up to 60 tonnes for each', async () => {
    const shipper = await newUser('shipper');
    const post = (overrides) => as(shipper.token).post('/api/loads').send(sampleLoad(overrides));

    for (const trucksNeeded of [0, 11, 2.5, '3']) expect((await post({ trucksNeeded })).status).toBe(400);
    expect((await post({ weight: 70000 })).status).toBe(400);
    expect((await post({ weight: 70000, trucksNeeded: 2 })).status).toBe(201);
  });
});

describe('trucks for a share of the load', () => {
  it('matches trucks that carry one truck\'s share, not the whole load', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    await addTruck(owner, { capacity: 10000 });
    await addTruck(owner, { truckType: 'mini-truck', capacity: 3000 });
    const load = await postLoad(shipper);

    const { matches } = (await as(shipper.token).get(`/api/loads/${load._id}/matches`).expect(200)).body;
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ truck: expect.objectContaining({ capacity: 10000 }), fillPercent: 100 });
  });
});

describe('owners applying with their trucks', () => {
  it('lets an owner apply with several trucks at one price each', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const trucks = [await addTruck(owner), await addTruck(owner)];
    const load = await postLoad(shipper);

    const res = await apply(owner, load, trucks, 14000).expect(201);

    expect(res.body.quotes).toHaveLength(2);
    expect(res.body.quotes.every((quote) => quote.quotedPrice === 14000)).toBe(true);
    expect((await Load().findById(load._id)).totalQuotes).toBe(2);

    const mine = (await as(owner.token).get(`/api/loads/${load._id}/my-trucks`).expect(200)).body.trucks;
    expect(mine.every((truck) => truck.offered)).toBe(true);
  });

  it('refuses more trucks than the load needs, or the same truck twice', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const trucks = [await addTruck(owner), await addTruck(owner), await addTruck(owner)];
    const load = await postLoad(shipper, { trucksNeeded: 2, weight: 20000 });

    await apply(owner, load, [trucks[0]]).expect(201);
    expect((await apply(owner, load, [trucks[0]])).status).toBe(409);

    const tooMany = await apply(owner, load, [trucks[1], trucks[2]]);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.message).toMatch(/up to 2/);
  });
});

describe('the shipper accepting trucks one at a time', () => {
  const threeApplications = async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);
    const owners = [await newUser('owner'), await newUser('owner'), await newUser('owner'), await newUser('owner')];
    const quotes = [];
    for (const owner of owners) quotes.push(await placeQuote(owner, load, 15000));
    return { shipper, load, owners, quotes };
  };

  it('books each truck separately and keeps the load open until every truck is found', async () => {
    const { shipper, load, quotes } = await threeApplications();

    const first = (await accept(shipper, quotes[0]).expect(200)).body;
    expect(first.load).toEqual({ trucksNeeded: 3, trucksBooked: 1 });
    expect(await Load().findById(load._id)).toMatchObject({ status: 'quoted', trucksBooked: 1 });
    expect((await Quote().findById(quotes[1]._id)).status).toBe('pending');

    // Everyone browsing sees the load is still looking, and how far along it is.
    const browse = (await as((await newUser('owner')).token).get('/api/loads').expect(200)).body.loads;
    expect(browse.find((l) => l._id === load._id)).toMatchObject({ trucksNeeded: 3, trucksBooked: 1 });

    await accept(shipper, quotes[1]).expect(200);
    const last = (await accept(shipper, quotes[2]).expect(200)).body;

    expect(last.load).toEqual({ trucksNeeded: 3, trucksBooked: 3 });
    expect(await Load().findById(load._id)).toMatchObject({ status: 'booked', trucksBooked: 3 });
    expect((await Quote().findById(quotes[3]._id)).status).toBe('rejected');
    expect(await mongoose.model('Booking').countDocuments({ loadId: load._id })).toBe(3);
  });

  it('shows the shipper which offers became which booking', async () => {
    const { shipper, load, quotes } = await threeApplications();
    const { booking } = (await accept(shipper, quotes[0]).expect(200)).body;

    const listed = (await as(shipper.token).get(`/api/loads/${load._id}/quotes`).expect(200)).body.quotes;
    expect(listed.find((q) => q._id === quotes[0]._id).booking).toEqual({ _id: booking._id, status: booking.status });
    expect(listed.find((q) => q._id === quotes[1]._id).booking).toBeNull();
  });

  it('never books more trucks than needed when acceptances race', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper, { trucksNeeded: 2, weight: 20000 });
    const quotes = [];
    for (let i = 0; i < 4; i += 1) quotes.push(await placeQuote(await newUser('owner'), load));

    const results = await Promise.all(quotes.map((quote) => accept(shipper, quote)));

    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(await mongoose.model('Booking').countDocuments({ loadId: load._id })).toBe(2);
    expect(await Load().findById(load._id)).toMatchObject({ status: 'booked', trucksBooked: 2 });
  });

  it('has no counter-offers: an offer is accepted or declined at its price', async () => {
    const { shipper, quotes } = await threeApplications();
    const res = await as(shipper.token).patch(`/api/quotes/${quotes[0]._id}/counter`).send({ counterOfferPrice: 12000 });
    expect(res.status).toBe(404);
  });

  it('lets a shipper ask a couple more trucks than they still need', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper, { trucksNeeded: 2, weight: 20000 });
    const trucks = [];
    for (let i = 0; i < 5; i += 1) trucks.push(await addTruck(await newUser('owner')));
    const ask = (truck) => as(shipper.token).post(`/api/loads/${load._id}/requests`).send({ truckId: truck._id, price: 15000 });

    for (const truck of trucks.slice(0, 4)) await ask(truck).expect(201);
    const fifth = await ask(trucks[4]);

    expect(fifth.status).toBe(409);
    expect(fifth.body.message).toMatch(/4 requests waiting/);
  });
});

describe('enough trucks, cancelling and running out of time', () => {
  it('lets the shipper stop looking once a truck is booked, closing the other offers', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);
    const quotes = [await placeQuote(await newUser('owner'), load), await placeQuote(await newUser('owner'), load)];

    expect((await as(shipper.token).patch(`/api/loads/${load._id}/close`)).status).toBe(400);
    await accept(shipper, quotes[0]).expect(200);

    // With a truck booked the load can't simply be withdrawn.
    expect((await as(shipper.token).patch(`/api/loads/${load._id}/cancel`)).body.code).toBe('LOADS_CANCEL_HAS_BOOKINGS');

    const closed = (await as(shipper.token).patch(`/api/loads/${load._id}/close`).expect(200)).body.load;
    expect(closed).toMatchObject({ status: 'booked', trucksNeeded: 3, trucksBooked: 1 });
    expect((await Quote().findById(quotes[1]._id)).status).toBe('rejected');
  });

  it('puts a cancelled truck\'s slot back on the market', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper, { trucksNeeded: 2, weight: 20000 });
    const quotes = [await placeQuote(await newUser('owner'), load), await placeQuote(await newUser('owner'), load)];
    const { booking } = (await accept(shipper, quotes[0]).expect(200)).body;
    await accept(shipper, quotes[1]).expect(200);
    expect((await Load().findById(load._id)).status).toBe('booked');

    await as(shipper.token).patch(`/api/bookings/${booking._id}/status`).send({ status: 'cancelled' }).expect(200);

    expect(await Load().findById(load._id)).toMatchObject({ status: 'open', trucksBooked: 1 });
    await placeQuote(await newUser('owner'), load);
  });

  it('sends the trucks already booked ahead when the load runs out of time', async () => {
    const shipper = await newUser('shipper');
    const partly = await postLoad(shipper);
    const empty = await postLoad(shipper);
    await accept(shipper, await placeQuote(await newUser('owner'), partly)).expect(200);
    await Load().updateMany({}, { expiresAt: new Date(Date.now() - 60 * 1000) });

    await expireStale();

    expect((await Load().findById(partly._id)).status).toBe('booked');
    expect((await Load().findById(empty._id)).status).toBe('expired');
  });
});
