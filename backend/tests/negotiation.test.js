const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, placeQuote,
} = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

// Builds a shipper with an open load and an owner who has quoted on it.
const setupNegotiation = async ({ quotedPrice = 15000 } = {}) => {
  const shipper = await signUp({ phone: uniquePhone(), role: 'shipper', firstName: 'Ram' });
  const owner = await signUp({ phone: uniquePhone(), role: 'owner', firstName: 'Bikash' });

  const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;
  const quote = await placeQuote(owner, load, quotedPrice);

  return { shipper, owner, load, quote };
};

describe('quote permissions', () => {
  it('stops a shipper quoting as if they were an owner', async () => {
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    const load = (await as(shipper.token).post('/api/loads').send(sampleLoad({ goodsType: 'Rice' }))).body.load;

    const res = await as(shipper.token).post('/api/quotes').send({ loadId: load._id, quotedPrice: 100 });
    expect(res.status).toBe(403);
  });

  it('rejects a non-positive quoted price', async () => {
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    const owner = await signUp({ phone: uniquePhone(), role: 'owner' });
    const load = (await as(shipper.token).post('/api/loads').send(sampleLoad({ goodsType: 'Rice' }))).body.load;

    const res = await as(owner.token).post('/api/quotes').send({ loadId: load._id, quotedPrice: -5 });
    expect(res.status).toBe(400);
  });

  it('hides another shipper\'s quotes', async () => {
    const { quote } = await setupNegotiation();
    const outsider = await signUp({ phone: uniquePhone(), role: 'shipper' });

    const res = await as(outsider.token).patch(`/api/quotes/${quote._id}/accept`);
    expect(res.status).toBe(403);
  });
});

describe('counter-offer turn taking', () => {
  it('lets the shipper accept the owner\'s original quote', async () => {
    const { shipper, quote } = await setupNegotiation({ quotedPrice: 15000 });

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);
    expect(res.body.booking.totalAmount).toBe(15000);
    expect(res.body.quote.acceptedBy).toBe('shipper');
  });

  it('stops the owner accepting their own standing quote', async () => {
    const { owner, quote } = await setupNegotiation();

    const res = await as(owner.token).patch(`/api/quotes/${quote._id}/accept`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/waiting on the other party/i);
  });

  // Before this fix a shipper could counter but the owner had no way to
  // accept, deadlocking the negotiation.
  it('lets the owner accept a shipper counter-offer at the countered price', async () => {
    const { shipper, owner, quote } = await setupNegotiation({ quotedPrice: 15000 });

    await as(shipper.token).patch(`/api/quotes/${quote._id}/counter`)
      .send({ counterOfferPrice: 12000 }).expect(200);

    const res = await as(owner.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);
    expect(res.body.booking.totalAmount).toBe(12000);
    expect(res.body.quote.acceptedBy).toBe('owner');
  });

  it('stops the shipper accepting their own counter-offer', async () => {
    const { shipper, quote } = await setupNegotiation();

    await as(shipper.token).patch(`/api/quotes/${quote._id}/counter`)
      .send({ counterOfferPrice: 12000 }).expect(200);

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`);
    expect(res.status).toBe(400);
  });

  it('allows counters to go back and forth', async () => {
    const { shipper, owner, quote } = await setupNegotiation({ quotedPrice: 15000 });

    await as(shipper.token).patch(`/api/quotes/${quote._id}/counter`)
      .send({ counterOfferPrice: 12000 }).expect(200);
    await as(owner.token).patch(`/api/quotes/${quote._id}/counter`)
      .send({ counterOfferPrice: 13500 }).expect(200);

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);
    expect(res.body.booking.totalAmount).toBe(13500);
  });

  it('rejects a non-numeric counter-offer', async () => {
    const { shipper, quote } = await setupNegotiation();
    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/counter`)
      .send({ counterOfferPrice: 'cheap' });
    expect(res.status).toBe(400);
  });

  it('refuses to accept an already-accepted quote twice', async () => {
    const { shipper, quote } = await setupNegotiation();
    await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already accepted/i);
  });
});
