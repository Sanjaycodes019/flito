const mongoose = require('mongoose');
const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, placeIn, areaIn, addTruck, quoteOn, placeQuote,
} = require('./helpers');
const { nepalDay, addDays } = require('../src/services/nepalTime');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const Truck = () => mongoose.model('Truck');

const newUser = (role, extra = {}) => signUp({ phone: uniquePhone(), role, ...extra });

const postLoad = async (shipper, overrides) =>
  (await as(shipper.token).post('/api/loads').send(sampleLoad(overrides)).expect(201)).body.load;

const matchesFor = async (shipper, load) =>
  (await as(shipper.token).get(`/api/loads/${load._id}/matches`).expect(200)).body;

const requestTruck = (shipper, load, truck, price) =>
  as(shipper.token).post(`/api/loads/${load._id}/requests`).send({ truckId: truck._id, price });

describe('posting a load', () => {
  it('requires the weight, and records the pickup day and road distance', async () => {
    const shipper = await newUser('shipper');

    const missing = await as(shipper.token).post('/api/loads').send(sampleLoad({ weight: undefined }));
    expect(missing.status).toBe(400);
    expect(missing.body.message).toMatch(/weight/);

    const load = await postLoad(shipper);
    expect(load.pickupDay).toBe(nepalDay());
    // Kathmandu to Pokhara is about 200 km by road.
    expect(load.distanceKm).toBeGreaterThan(170);
    expect(load.distanceKm).toBeLessThan(230);
  });

  it('takes a pickup date from today to 14 days ahead, and stays open until that day ends', async () => {
    const shipper = await newUser('shipper');

    const later = await postLoad(shipper, { pickupDate: addDays(nepalDay(), 3) });
    expect(later.pickupDay).toBe(addDays(nepalDay(), 3));
    expect(new Date(later.expiresAt).getTime()).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60 * 1000);

    for (const pickupDate of [addDays(nepalDay(), -1), addDays(nepalDay(), 15), 'soon']) {
      expect((await as(shipper.token).post('/api/loads').send(sampleLoad({ pickupDate }))).status).toBe(400);
    }
  });
});

describe('matching trucks to a load', () => {
  it('lists only trucks that are active, big enough, free that day and run by a verified owner', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const unverified = await newUser('owner', { verified: false });

    const fits = await addTruck(owner);
    await addTruck(owner, { truckType: 'mini-truck', capacity: 3000 });
    const parked = await addTruck(owner);
    await as(owner.token).patch(`/api/trucks/${parked._id}`).send({ status: 'maintenance' }).expect(200);
    const booked = await addTruck(owner);
    await Truck().updateOne({ _id: booked._id }, { $push: { reservedDays: nepalDay() } });
    await addTruck(unverified);

    const load = await postLoad(shipper);
    const { matches, takingOffers } = await matchesFor(shipper, load);

    expect(takingOffers).toBe(true);
    expect(matches.map((m) => m.truck._id)).toEqual([fits._id]);
    expect(matches[0]).toMatchObject({
      fillPercent: 60,
      askingPrice: Math.max(5000, Math.round((80 * load.distanceKm) / 100) * 100),
      offer: null,
    });
    // Registration numbers stay private until a booking is made.
    expect(matches[0].truck.registrationNumber).toBeUndefined();
  });

  it('ranks a nearby truck the load fills well above a distant or oversized one', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const nearby = await addTruck(owner, { baseLocation: areaIn('Kathmandu') });
    const distant = await addTruck(owner, { baseLocation: areaIn('Biratnagar') });
    const oversized = await addTruck(owner, { truckType: '12-wheeler', capacity: 25000 });

    const load = await postLoad(shipper);
    const { matches } = await matchesFor(shipper, load);

    expect(matches.map((m) => m.truck._id)).toEqual([nearby._id, oversized._id, distant._id]);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
    expect(matches[0].reasons).toEqual(expect.arrayContaining(['Fills 60% of the truck', 'Based near the pickup']));
    expect(matches[0].truck.base).toBe('Kathmandu');
  });

  it("shows an owner which of their trucks can take a load, and each one's price", async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const big = await addTruck(owner);
    const small = await addTruck(owner, { truckType: 'mini-truck', capacity: 3000 });
    const load = await postLoad(shipper);

    const { trucks } = (await as(owner.token).get(`/api/loads/${load._id}/my-trucks`).expect(200)).body;
    const byId = Object.fromEntries(trucks.map((t) => [t._id, t]));

    expect(byId[big._id]).toMatchObject({ unavailableReason: null, askingPrice: expect.any(Number) });
    expect(byId[small._id].unavailableReason).toBe('Carries up to 3,000 kg, and this load is 6,000 kg');
  });
});

describe('a shipper requesting a truck', () => {
  const setup = async ({ withDriver = false } = {}) => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const truck = await addTruck(owner);
    let driver = null;
    if (withDriver) {
      const phone = uniquePhone();
      driver = await signUp({ phone, role: 'driver', firstName: 'Hari' });
      await as(owner.token).patch(`/api/trucks/${truck._id}/driver`).send({ driverPhone: phone }).expect(200);
    }
    const load = await postLoad(shipper);
    return { shipper, owner, truck, driver, load };
  };

  it('books the truck when the owner accepts, reserving its day and bringing its driver', async () => {
    const { shipper, owner, truck, driver, load } = await setup({ withDriver: true });

    const quote = (await requestTruck(shipper, load, truck, 15000).expect(201)).body.quote;
    expect(quote).toMatchObject({ initiatedBy: 'shipper', status: 'pending' });

    // The shipper made this offer, so only the owner can accept it.
    expect((await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`)).status).toBe(400);
    const { booking } = (await as(owner.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;

    expect(booking).toMatchObject({ totalAmount: 15000, truckId: truck._id, driverId: driver.id, status: 'confirmed' });
    expect((await Truck().findById(truck._id)).reservedDays).toContain(load.pickupDay);

    // Booked for the day, the truck no longer shows up for another load that day.
    const other = await postLoad(shipper);
    expect((await matchesFor(shipper, other)).matches).toHaveLength(0);
  });

  it('frees the truck again when the booking is cancelled', async () => {
    const { shipper, owner, truck, load } = await setup();
    const quote = (await requestTruck(shipper, load, truck, 15000).expect(201)).body.quote;
    const { booking } = (await as(owner.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;

    await as(shipper.token).patch(`/api/bookings/${booking._id}/status`).send({ status: 'cancelled' }).expect(200);

    expect((await Truck().findById(truck._id)).reservedDays).not.toContain(load.pickupDay);
  });

  it('shows the open request on the match', async () => {
    const { shipper, truck, load } = await setup();
    await requestTruck(shipper, load, truck, 15000).expect(201);

    const { matches, openRequests, maxOpenRequests } = await matchesFor(shipper, load);

    expect(matches[0].offer).toMatchObject({ initiatedBy: 'shipper', price: 15000, by: 'shipper', status: 'pending' });
    expect({ openRequests, maxOpenRequests }).toEqual({ openRequests: 1, maxOpenRequests: 3 });
  });

  it('allows three waiting requests per load', async () => {
    const shipper = await newUser('shipper');
    const load = await postLoad(shipper);
    const trucks = [];
    for (let i = 0; i < 4; i += 1) trucks.push(await addTruck(await newUser('owner')));

    for (const truck of trucks.slice(0, 3)) await requestTruck(shipper, load, truck, 15000).expect(201);
    const fourth = await requestTruck(shipper, load, trucks[3], 15000);

    expect(fourth.status).toBe(409);
    expect(fourth.body.message).toMatch(/3 requests waiting/);
  });

  it('keeps one negotiation per owner on a load', async () => {
    const { shipper, owner, truck, load } = await setup();
    await placeQuote(owner, load, 16000, truck);

    const res = await requestTruck(shipper, load, truck, 15000);
    expect(res.status).toBe(409);
  });

  it("refuses a truck too small for the load, and another shipper's load", async () => {
    const { shipper, owner, truck, load } = await setup();
    const small = await addTruck(owner, { truckType: 'mini-truck', capacity: 3000 });

    const tooSmall = await requestTruck(shipper, load, small, 15000);
    expect(tooSmall.status).toBe(400);
    expect(tooSmall.body.message).toMatch(/Carries up to 3,000 kg/);

    const stranger = await newUser('shipper');
    expect((await requestTruck(stranger, load, truck, 15000)).status).toBe(403);
  });
});

describe('an owner quoting with a truck', () => {
  it('needs one of their own trucks that can carry the load', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const rival = await newUser('owner');
    const load = await postLoad(shipper);

    expect((await as(owner.token).post('/api/quotes').send({ loadId: load._id, quotedPrice: 15000 })).status).toBe(400);
    expect((await quoteOn(owner, load, 15000, await addTruck(rival))).status).toBe(404);
    expect((await quoteOn(owner, load, 15000, await addTruck(owner, { truckType: 'mini-truck', capacity: 3000 }))).status).toBe(400);

    const quote = await placeQuote(owner, load, 15000);
    expect(quote).toMatchObject({ initiatedBy: 'owner', truckId: expect.objectContaining({ truckType: '6-wheeler' }) });
  });

  it('refuses to book a truck that was booked elsewhere for the same day', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const truck = await addTruck(owner);
    const first = await postLoad(shipper);
    const second = await postLoad(shipper);
    const firstQuote = await placeQuote(owner, first, 15000, truck);
    const secondQuote = await placeQuote(owner, second, 15000, truck);

    await as(shipper.token).patch(`/api/quotes/${firstQuote._id}/accept`).expect(200);
    const res = await as(shipper.token).patch(`/api/quotes/${secondQuote._id}/accept`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/no longer available/);
    expect((await mongoose.model('Load').findById(second._id)).status).toBe('quoted');
  });
});

describe('counter-offers move toward agreement', () => {
  const opened = async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    const quote = await placeQuote(owner, load, 15000);
    const counter = (actor, price) => as(actor.token).patch(`/api/quotes/${quote._id}/counter`).send({ counterOfferPrice: price });
    return { shipper, owner, quote, counter };
  };

  it("keeps each side's offers moving toward the other's", async () => {
    const { shipper, owner, counter } = await opened();

    expect((await counter(shipper, 15000)).body.message).toMatch(/accept that price/);
    await counter(shipper, 12000).expect(200);

    expect((await counter(owner, 12000)).body.message).toMatch(/accept that price/);
    expect((await counter(owner, 16000)).body.message).toMatch(/has to be lower/);
    await counter(owner, 14000).expect(200);

    expect((await counter(shipper, 11000)).body.message).toMatch(/has to be higher/);
    const res = await counter(shipper, 13000).expect(200);

    expect(res.body.quote.offers.map((o) => [o.by, o.price])).toEqual([
      ['owner', 15000], ['shipper', 12000], ['owner', 14000], ['shipper', 13000],
    ]);
  });

  it('ends in a decision after six offers', async () => {
    const { shipper, owner, quote, counter } = await opened();

    await counter(shipper, 10000).expect(200);
    await counter(owner, 14000).expect(200);
    await counter(shipper, 11000).expect(200);
    await counter(owner, 13000).expect(200);
    await counter(shipper, 12000).expect(200);

    const seventh = await counter(owner, 12500);
    expect(seventh.status).toBe(400);
    expect(seventh.body.message).toMatch(/6 offers/);

    const { booking } = (await as(owner.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
    expect(booking.totalAmount).toBe(12000);
  });

  it('only takes whole-rupee prices', async () => {
    const { shipper, counter } = await opened();
    expect((await counter(shipper, 12000.5)).status).toBe(400);
    expect((await counter(shipper, 50)).status).toBe(400);
  });
});

describe('fleet details', () => {
  const inAYear = () => addDays(nepalDay(), 365);

  const fullTruck = () => ({
    registrationNumber: 'ba 2 kha 4567',
    truckType: '6-wheeler',
    bodyType: 'covered',
    capacity: 10000,
    make: 'Tata',
    model: '1613',
    year: 2019,
    fuelType: 'diesel',
    cargoBed: { lengthFt: 19, widthFt: 7.5, heightFt: 7 },
    features: { tarpaulin: true, helper: true, gpsTracker: false, hillRoads: true },
    baseLocation: areaIn('Lalitpur'),
    serviceArea: 'nepal',
    ratePerKm: 75,
    minimumCharge: 4000,
    chassisNumber: 'mat447206k1a12345',
    engineNumber: '697tc31abc12345',
    bluebookRenewedUntil: inAYear(),
    insurance: { type: 'comprehensive', company: 'Shikhar Insurance', policyNumber: 'MV/2083/12345', validUntil: inAYear() },
    emissionTestValidUntil: inAYear(),
  });

  it('requires the class, body and capacity, and checks the base and rates', async () => {
    const owner = await newUser('owner');
    const post = (body) => as(owner.token).post('/api/trucks').send({ ...fullTruck(), ...body });

    expect((await post({ capacity: undefined })).status).toBe(400);
    expect((await post({ bodyType: undefined })).body.message).toBe('bodyType is required');
    expect((await post({ truckType: 'spaceship' })).status).toBe(400);
    // Older classes stay on trucks already listed, but new trucks can't use them.
    expect((await post({ truckType: '10-ton' })).status).toBe(400);
    expect((await post({ baseLocation: { provinceId: 'NP01' } })).body.message).toMatch(/^Base location/);
    expect((await post({ ratePerKm: -3 })).status).toBe(400);

    const truck = (await post({}).expect(201)).body.truck;
    const cleared = await as(owner.token).patch(`/api/trucks/${truck._id}`).send({ ratePerKm: null }).expect(200);
    expect(cleared.body.truck.ratePerKm).toBeUndefined();
    expect(cleared.body.truck.minimumCharge).toBe(4000);
  });

  it('records what the truck is and its papers, tidied up', async () => {
    const owner = await newUser('owner');

    const { truck } = (await as(owner.token).post('/api/trucks').send(fullTruck()).expect(201)).body;

    expect(truck).toMatchObject({
      registrationNumber: 'BA 2 KHA 4567',
      makeModel: 'Tata 1613',
      year: 2019,
      bodyType: 'covered',
      cargoBed: { lengthFt: 19, widthFt: 7.5, heightFt: 7 },
      features: { tarpaulin: true, helper: true, gpsTracker: false, hillRoads: true },
      chassisNumber: 'MAT447206K1A12345',
      insurance: { type: 'comprehensive', company: 'Shikhar Insurance', policyNumber: 'MV/2083/12345' },
    });
    expect(truck.insurance.validUntil.slice(0, 10)).toBe(inAYear());
  });

  it('refuses a make, fuel or date it does not know', async () => {
    const owner = await newUser('owner');
    const post = (body) => as(owner.token).post('/api/trucks').send({ ...fullTruck(), ...body });

    expect((await post({ make: 'Spaceship Co' })).body.message).toMatch(/^make must be one of/);
    expect((await post({ fuelType: 'coal' })).body.message).toMatch(/^fuelType must be one of/);
    expect((await post({ bluebookRenewedUntil: '2083-13-01' })).body.message).toBe('bluebookRenewedUntil must be a date written YYYY-MM-DD');
    expect((await post({ insurance: { validUntil: 'next year' } })).body.message).toMatch(/^insurance.validUntil/);
    expect((await post({ cargoBed: { lengthFt: 120 } })).body.message).toMatch(/^cargoBed.lengthFt/);
    expect((await post({ chassisNumber: 'MAT#1' })).status).toBe(400);
  });

  it('shows shippers what the truck offers, but never its numbers or papers', async () => {
    const owner = await newUser('owner');
    const shipper = await newUser('shipper');
    await as(owner.token).post('/api/trucks').send({ ...fullTruck(), baseLocation: areaIn('Kathmandu') }).expect(201);
    const load = await postLoad(shipper);

    const [{ truck }] = (await matchesFor(shipper, load)).matches;

    expect(truck).toMatchObject({
      bodyType: 'covered',
      makeModel: 'Tata 1613',
      year: 2019,
      insurance: 'comprehensive',
      features: { tarpaulin: true, helper: true, gpsTracker: false, hillRoads: true },
    });
    for (const secret of ['registrationNumber', 'chassisNumber', 'engineNumber', 'bluebookRenewedUntil', 'emissionTestValidUntil']) {
      expect(truck[secret]).toBeUndefined();
    }
  });

  it('ranks an insured truck above an otherwise identical uninsured one', async () => {
    const owner = await newUser('owner');
    const shipper = await newUser('shipper');
    const uninsured = await addTruck(owner);
    const insured = await addTruck(owner, { insurance: { type: 'third-party', validUntil: inAYear() } });
    // Lapsed insurance counts for nothing.
    await addTruck(owner, { insurance: { type: 'comprehensive', validUntil: addDays(nepalDay(), -1) } });
    const load = await postLoad(shipper);

    const { matches } = await matchesFor(shipper, load);

    expect(matches[0].truck._id).toBe(insured._id);
    expect(matches[0].truck.insurance).toBe('third-party');
    expect(matches[0].score - matches.find((m) => m.truck._id === uninsured._id).score).toBe(3);
    expect(matches.filter((m) => m.truck.insurance === null)).toHaveLength(2);
  });

  it('only matches a truck working within its district to loads inside that district', async () => {
    const owner = await newUser('owner');
    const shipper = await newUser('shipper');
    const local = await addTruck(owner, { serviceArea: 'district' });

    const toPokhara = await postLoad(shipper);
    expect((await matchesFor(shipper, toPokhara)).matches).toHaveLength(0);
    const { trucks } = (await as(owner.token).get(`/api/loads/${toPokhara._id}/my-trucks`).expect(200)).body;
    expect(trucks[0].unavailableReason).toBe('Only takes loads within Kathmandu district');

    const acrossTown = await postLoad(shipper, { dropoffLocation: placeIn('Kathmandu', 13, 'Kalimati') });
    expect((await matchesFor(shipper, acrossTown)).matches.map((m) => m.truck._id)).toEqual([local._id]);
  });
});
