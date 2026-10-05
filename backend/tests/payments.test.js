// QR codes and payment screenshots run through the real routes, middleware and
// database; only the calls to Cloudinary are replaced.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(),
  uploadPaymentImage: jest.fn(),
  deleteAssets: jest.fn(),
}));

const storage = require('../src/services/storage');
const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, placeQuote,
} = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  storage.isConfigured.mockReturnValue(true);
  storage.deleteAssets.mockResolvedValue(undefined);
  let counter = 0;
  storage.uploadPaymentImage.mockImplementation(async (file, { folder }) => {
    counter += 1;
    return { url: `https://res.cloudinary.com/demo/image/upload/${folder}/img${counter}.png`, publicId: `${folder}/img${counter}` };
  });
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const newUser = (role) => signUp({ phone: uniquePhone(), role });

const NABIL = { kind: 'bank', bankCode: 'nabil', accountName: 'Bikash Transport', accountNumber: '0123 4567 8901 23', branch: 'Teku' };
const ESEWA = { kind: 'esewa', accountName: 'Bikash Thapa', walletId: '+977 984-1234567' };

// Multipart, the way the app sends it, with an optional QR image.
const sendMethod = (req, fields, { qr = false } = {}) => {
  Object.entries(fields).forEach(([key, value]) => req.field(key, String(value)));
  if (qr) req.attach('qr', PNG, { filename: 'qr.png', contentType: 'image/png' });
  return req;
};
const addMethod = (owner, fields, options) => sendMethod(as(owner.token).post('/api/users/me/payout-methods'), fields, options);

// A booking worth Rs. 15,000 between a new shipper and owner.
const setupBooking = async () => {
  const shipper = await newUser('shipper');
  const owner = await newUser('owner');
  const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;
  const quote = await placeQuote(owner, load, 15000);
  const booking = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body.booking;
  return { shipper, owner, booking };
};

describe('owner payment details', () => {
  it('adds a bank account, tidying the number, and makes the first one primary', async () => {
    const owner = await newUser('owner');

    const res = await addMethod(owner, NABIL).expect(201);

    expect(res.body.payoutMethods).toEqual([expect.objectContaining({
      kind: 'bank',
      bankCode: 'nabil',
      bankName: 'Nabil Bank',
      accountNumber: '01234567890123',
      accountName: 'Bikash Transport',
      branch: 'Teku',
      qrUrl: null,
      primary: true,
    })]);
  });

  it('adds an eSewa wallet with its QR, keeping the storage id private', async () => {
    const owner = await newUser('owner');

    const res = await addMethod(owner, ESEWA, { qr: true }).expect(201);

    const [wallet] = res.body.payoutMethods;
    expect(wallet).toMatchObject({ kind: 'esewa', walletId: '9841234567' });
    expect(wallet).not.toHaveProperty('accountNumber');
    expect(wallet.qrUrl).toContain(`flito/payout/${owner.id}/img1`);
    expect(JSON.stringify(res.body)).not.toContain('publicId');
  });

  it('takes a bank with only its QR, but not with neither number nor QR', async () => {
    const owner = await newUser('owner');
    const { accountNumber, ...withoutNumber } = NABIL;

    const refused = await addMethod(owner, withoutNumber).expect(400);
    expect(refused.body.code).toBe('PAYOUT_ACCOUNT_OR_QR_REQUIRED');
    expect(storage.uploadPaymentImage).not.toHaveBeenCalled();

    await addMethod(owner, withoutNumber, { qr: true }).expect(201);
  });

  it('needs a typed name for a bank not on the list', async () => {
    const owner = await newUser('owner');

    const refused = await addMethod(owner, { ...NABIL, bankCode: 'other' }).expect(400);
    expect(refused.body.code).toBe('PAYOUT_BANK_NAME_REQUIRED');

    const res = await addMethod(owner, { ...NABIL, bankCode: 'other', bankName: 'Muktinath Bikas Bank' }).expect(201);
    expect(res.body.payoutMethods[0].bankName).toBe('Muktinath Bikas Bank');
  });

  it('refuses a wrong wallet number or an unknown bank', async () => {
    const owner = await newUser('owner');

    expect((await addMethod(owner, { ...ESEWA, walletId: '12345' }).expect(400)).body.code).toBe('VALIDATION_PAYOUT_WALLET_ID');
    expect((await addMethod(owner, { ...NABIL, bankCode: 'madeup' }).expect(400)).body.code).toBe('VALIDATION_PAYOUT_BANK');
  });

  it('is only for truck owners', async () => {
    const shipper = await newUser('shipper');
    await addMethod(shipper, ESEWA).expect(403);
  });

  it('replaces a QR and deletes the old file, and moves primary on delete', async () => {
    const owner = await newUser('owner');
    const first = (await addMethod(owner, ESEWA, { qr: true }).expect(201)).body.payoutMethods[0];
    await addMethod(owner, NABIL).expect(201);

    const updated = await sendMethod(as(owner.token).patch(`/api/users/me/payout-methods/${first._id}`), { accountName: 'B. Thapa' }, { qr: true })
      .expect(200);
    const wallet = updated.body.payoutMethods.find((m) => m._id === first._id);
    expect(wallet).toMatchObject({ accountName: 'B. Thapa', qrUrl: expect.stringContaining('img2') });
    expect(storage.deleteAssets).toHaveBeenCalledWith([`flito/payout/${owner.id}/img1`]);

    const after = await as(owner.token).delete(`/api/users/me/payout-methods/${first._id}`).expect(200);
    expect(after.body.payoutMethods).toEqual([expect.objectContaining({ kind: 'bank', primary: true })]);
  });

  it('switches which method is primary', async () => {
    const owner = await newUser('owner');
    await addMethod(owner, ESEWA).expect(201);
    const bank = (await addMethod(owner, NABIL).expect(201)).body.payoutMethods.find((m) => m.kind === 'bank');

    const res = await as(owner.token).post(`/api/users/me/payout-methods/${bank._id}/primary`).expect(200);

    expect(res.body.payoutMethods.map((m) => [m.kind, m.primary])).toEqual([['bank', true], ['esewa', false]]);
  });
});

describe('booking payments', () => {
  const report = (actor, booking, fields, { proof = false } = {}) => {
    const req = as(actor.token).post(`/api/bookings/${booking._id}/payments`);
    Object.entries(fields).forEach(([key, value]) => req.field(key, String(value)));
    if (proof) req.attach('proof', PNG, { filename: 'paid.png', contentType: 'image/png' });
    return req;
  };

  it("shows the shipper the owner's accounts and what is due", async () => {
    const { shipper, owner, booking } = await setupBooking();
    await addMethod(owner, NABIL, { qr: true }).expect(201);

    const res = await as(shipper.token).get(`/api/bookings/${booking._id}/payments`).expect(200);

    expect(res.body.party).toBe('shipper');
    expect(res.body.summary).toEqual({ total: 15000, paid: 0, awaitingConfirmation: 0, due: 15000, status: 'pending' });
    expect(res.body.payTo).toEqual([expect.objectContaining({ bankName: 'Nabil Bank', accountNumber: '01234567890123' })]);
  });

  it('keeps payments from outsiders and the driver', async () => {
    const { booking } = await setupBooking();
    const outsider = await newUser('shipper');
    const driver = await newUser('driver');

    await as(outsider.token).get(`/api/bookings/${booking._id}/payments`).expect(403);
    await as(driver.token).get(`/api/bookings/${booking._id}/payments`).expect(403);
  });

  it('counts a reported payment only once the owner confirms it', async () => {
    const { shipper, owner, booking } = await setupBooking();
    const account = (await addMethod(owner, ESEWA).expect(201)).body.payoutMethods[0];

    const reported = await report(shipper, booking, {
      amount: 5000, method: 'bank', payoutMethodId: account._id, transactionId: 'ESW123',
    }, { proof: true }).expect(201);

    const [payment] = reported.body.payments;
    expect(payment).toMatchObject({
      amount: 5000, method: 'esewa', status: 'reported', paidTo: 'eSewa 9841234567', transactionId: 'ESW123', recordedBy: 'shipper',
    });
    expect(payment.proofUrl).toContain(`flito/payments/${booking._id}`);
    expect(reported.body.summary).toMatchObject({ paid: 0, awaitingConfirmation: 5000 });

    const confirmed = await as(owner.token).post(`/api/bookings/${booking._id}/payments/${payment._id}/confirm`).expect(200);
    expect(confirmed.body.payments[0].status).toBe('completed');
    expect(confirmed.body.summary).toMatchObject({ paid: 5000, due: 10000, status: 'partial' });

    // A second tap changes nothing.
    await as(owner.token).post(`/api/bookings/${booking._id}/payments/${payment._id}/confirm`).expect(400);
    const seen = (await as(shipper.token).get(`/api/bookings/${booking._id}`).expect(200)).body.booking;
    expect(seen).toMatchObject({ amountPaid: 5000, amountPending: 10000, paymentStatus: 'partial', paymentMethod: 'esewa' });
  });

  it('marks the booking paid when the owner records the rest in cash', async () => {
    const { owner, booking } = await setupBooking();

    const res = await report(owner, booking, { amount: 15000, method: 'cash', note: 'Paid to driver at drop-off' }).expect(201);

    expect(res.body.payments[0]).toMatchObject({ status: 'completed', recordedBy: 'owner' });
    expect(res.body.summary).toMatchObject({ paid: 15000, due: 0, status: 'completed' });
  });

  it("won't take more than is left to pay, counting reports still waiting", async () => {
    const { shipper, booking } = await setupBooking();
    await report(shipper, booking, { amount: 10000, method: 'cash' }).expect(201);

    const res = await report(shipper, booking, { amount: 6000, method: 'cash' }).expect(400);

    expect(res.body).toMatchObject({ code: 'PAYMENTS_MORE_THAN_DUE', extra: { due: 5000 } });
  });

  it('lets only the owner answer, and records a payment that never arrived', async () => {
    const { shipper, owner, booking } = await setupBooking();
    const payment = (await report(shipper, booking, { amount: 2000, method: 'khalti' }).expect(201)).body.payments[0];

    await as(shipper.token).post(`/api/bookings/${booking._id}/payments/${payment._id}/confirm`).expect(403);

    const res = await as(owner.token).post(`/api/bookings/${booking._id}/payments/${payment._id}/dispute`)
      .send({ reason: 'Nothing in my Khalti' }).expect(200);
    expect(res.body.payments[0]).toMatchObject({ status: 'disputed', disputeReason: 'Nothing in my Khalti' });
    expect(res.body.summary).toMatchObject({ paid: 0, due: 15000 });
  });

  it("refuses an account that isn't the owner's", async () => {
    const { shipper, booking } = await setupBooking();
    const stranger = await newUser('owner');
    const theirs = (await addMethod(stranger, ESEWA).expect(201)).body.payoutMethods[0];

    const res = await report(shipper, booking, { amount: 1000, method: 'esewa', payoutMethodId: theirs._id }).expect(404);
    expect(res.body.code).toBe('PAYMENTS_ACCOUNT_NOT_FOUND');
  });

  it('stops payments and hides the accounts once a booking is cancelled', async () => {
    const { shipper, owner, booking } = await setupBooking();
    await addMethod(owner, ESEWA).expect(201);
    await as(shipper.token).patch(`/api/bookings/${booking._id}/status`).send({ status: 'cancelled' }).expect(200);

    const seen = await as(shipper.token).get(`/api/bookings/${booking._id}/payments`).expect(200);
    expect(seen.body.payTo).toEqual([]);
    await report(shipper, booking, { amount: 1000, method: 'cash' }).expect(400);
  });

  it('refuses a made-up amount', async () => {
    const { shipper, booking } = await setupBooking();
    const res = await report(shipper, booking, { amount: '12.5', method: 'cash' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_PAYMENT_AMOUNT');
  });
});
