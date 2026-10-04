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

describe('accepting or declining an offer', () => {
  it('lets the shipper accept the owner\'s offer at its price', async () => {
    const { shipper, quote } = await setupNegotiation({ quotedPrice: 15000 });

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);
    expect(res.body.booking.totalAmount).toBe(15000);
    expect(res.body.quote.acceptedBy).toBe('shipper');
  });

  it('stops the owner accepting their own offer', async () => {
    const { owner, quote } = await setupNegotiation();

    const res = await as(owner.token).patch(`/api/quotes/${quote._id}/accept`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/waiting on the other party/i);
  });

  it('lets the shipper decline an offer, opening the load again', async () => {
    const { shipper, load, quote } = await setupNegotiation();

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/reject`).expect(200);
    expect(res.body.quote.status).toBe('rejected');

    const after = (await as(shipper.token).get(`/api/loads/${load._id}`).expect(200)).body.load;
    expect(after.status).toBe('open');
  });

  it('refuses to accept an already-accepted quote twice', async () => {
    const { shipper, quote } = await setupNegotiation();
    await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200);

    const res = await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already accepted/i);
  });
});
