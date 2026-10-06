// FLITO's fees: a charge on each delivered trip, billed by Nepali month; the
// owner's payments, which an admin confirms; FLITO's own accounts; and the
// stop on new offers when fees are past due.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(() => true),
  uploadPaymentImage: jest.fn(async (file, { folder }) => ({ url: `https://res.cloudinary.com/demo/${folder}/img.png`, publicId: `${folder}/img` })),
  deleteAssets: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, placeQuote, quoteOn,
} = require('./helpers');
const { commissionFor } = require('../src/config/commission');
const { summarize } = require('../src/services/commission');
const { bsMonthOf } = require('../src/services/bsCalendar');
const { nepalDay } = require('../src/services/nepalTime');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const User = () => require('../src/models/User');
const CommissionCharge = () => require('../src/models/CommissionCharge');

const newUser = (role) => signUp({ phone: uniquePhone(), role });

const newAdmin = async () => {
  const admin = await User().create({ phone: uniquePhone(), role: 'admin', firstName: 'Sita', lastName: 'Admin' });
  const token = jwt.sign({ userId: admin._id, phone: admin.phone, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { id: String(admin._id), token };
};

// A booking at `fare` between a new shipper and owner, with a driver on it.
const bookedTrip = async (fare = 15000, owner = null) => {
  const shipper = await newUser('shipper');
  const truckOwner = owner || await newUser('owner');
  const driver = await newUser('driver');
  const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;
  const quote = await placeQuote(truckOwner, load, fare);
  const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
  await as(truckOwner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver.id }).expect(200);
  return { shipper, owner: truckOwner, driver, load, booking };
};

const deliver = async ({ driver, booking }) => {
  await as(driver.token).patch(`/api/bookings/${booking._id}/status`).send({ status: 'in_transit', pickupStatus: 'picked_up' }).expect(200);
  await as(driver.token).patch(`/api/bookings/${booking._id}/status`).send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);
};

const pay = (owner, fields) => {
  const req = as(owner.token).post('/api/commission/me/payments');
  Object.entries(fields).forEach(([key, value]) => req.field(key, String(value)));
  return req;
};

describe('the fee on a fare', () => {
  it('is 3% of the fare, at least Rs. 1,000, never more than 4%', () => {
    expect(commissionFor(15000)).toEqual({ rate: 0.04, amount: 600 });
    expect(commissionFor(30000)).toEqual({ rate: 0.0333, amount: 1000 });
    expect(commissionFor(60000)).toEqual({ rate: 0.03, amount: 1800 });
    expect(commissionFor(150000)).toEqual({ rate: 0.03, amount: 4500 });
  });

  it('never gets smaller as the fare gets bigger, and never passes 4%', () => {
    let previous = 0;
    for (let fare = 500; fare <= 200000; fare += 500) {
      const { amount } = commissionFor(fare);
      expect(amount).toBeGreaterThanOrEqual(previous);
      expect(amount).toBeLessThanOrEqual(fare * 0.04);
      if (fare >= 25000) expect(amount).toBeGreaterThanOrEqual(1000);
      previous = amount;
    }
  });
});

describe('billing by Nepali month', () => {
  // 19 Ashwin 2083. Bhadra's fees were due by 15 Ashwin, 1 October.
  const today = '2026-10-05';

  it('marks an unpaid past month overdue and stops new offers', () => {
    const account = summarize([{ period: '2083-05', trips: 2, amount: 600 }, { period: '2083-06', trips: 1, amount: 300 }], [], today);

    expect(account.periods.map((row) => [row.period, row.status, row.dueDay])).toEqual([
      ['2083-06', 'open', '2026-11-01'],
      ['2083-05', 'overdue', '2026-10-01'],
    ]);
    expect(account).toMatchObject({ balance: 900, payableNow: 600, overdue: 600, blocked: true, maxPayment: 900 });
  });

  it('pays off the oldest month first, and lets a payment waiting for review count', () => {
    const confirmed = { status: 'confirmed', amount: 700 };
    const account = summarize([{ period: '2083-05', trips: 2, amount: 600 }, { period: '2083-06', trips: 1, amount: 300 }], [confirmed], today);
    expect(account.periods.map((row) => [row.status, row.left])).toEqual([['open', 200], ['paid', 0]]);
    expect(account.blocked).toBe(false);

    const waiting = summarize([{ period: '2083-05', trips: 2, amount: 600 }], [{ status: 'reported', amount: 600 }], today);
    expect(waiting).toMatchObject({ overdue: 600, awaiting: 600, blocked: false, maxPayment: 0 });
  });

  it('gives a month until the 15th of the next one', () => {
    const account = summarize([{ period: '2083-05', trips: 1, amount: 300 }], [], '2026-09-30');
    expect(account.periods[0]).toMatchObject({ status: 'due', dueDay: '2026-10-01' });
    expect(account.blocked).toBe(false);
  });
});

describe('charges on delivered trips', () => {
  it('adds the fee once, when the driver marks the delivery done', async () => {
    const trip = await bookedTrip(15000);
    expect(await CommissionCharge().countDocuments()).toBe(0);

    await deliver(trip);

    const charges = await CommissionCharge().find();
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ fare: 15000, rate: 0.04, amount: 600, period: bsMonthOf(nepalDay()) });

    const mine = await as(trip.owner.token).get('/api/commission/me').expect(200);
    expect(mine.body.summary).toMatchObject({ charged: 600, balance: 600, payableNow: 0, blocked: false });
    expect(mine.body.summary.periods[0]).toMatchObject({ trips: 1, amount: 600, status: 'open' });
    expect(mine.body.charges[0]).toMatchObject({ fare: 15000, amount: 600, goodsType: 'Cement' });
    expect(mine.body.rules.startsOn).toBe('2000-01-01');
    // Owners see each fee, never the rule behind it.
    const sent = JSON.stringify(mine.body);
    ['percent', 'rate', 'minFee', 'maxPercent', 'examples'].forEach((key) => expect(sent).not.toContain(`"${key}"`));
  });

  it("doesn't charge a cancelled trip", async () => {
    const { shipper, booking } = await bookedTrip();
    await as(shipper.token).patch(`/api/bookings/${booking._id}/status`).send({ status: 'cancelled' }).expect(200);
    expect(await CommissionCharge().countDocuments()).toBe(0);
  });

  it("shows the owner, and only the owner, the fee on their booking", async () => {
    const trip = await bookedTrip(30000);
    const seen = await as(trip.owner.token).get(`/api/bookings/${trip.booking._id}/payments`).expect(200);
    expect(seen.body.commission).toEqual({
      amount: 1000, charged: false, welcome: false, period: null,
    });

    await deliver(trip);
    const after = await as(trip.owner.token).get(`/api/bookings/${trip.booking._id}/payments`).expect(200);
    expect(after.body.commission).toMatchObject({ amount: 1000, charged: true });

    const shipperView = await as(trip.shipper.token).get(`/api/bookings/${trip.booking._id}/payments`).expect(200);
    expect(shipperView.body.commission).toBeUndefined();
  });

  it("makes an owner's first trips free, and says so", async () => {
    process.env.COMMISSION_WELCOME_TRIPS = '1';
    try {
      const first = await bookedTrip(15000);
      const before = await as(first.owner.token).get(`/api/bookings/${first.booking._id}/payments`).expect(200);
      expect(before.body.commission).toMatchObject({ amount: 0, welcome: true, charged: false });
      await deliver(first);

      const second = await bookedTrip(15000, first.owner);
      await deliver(second);

      const mine = await as(first.owner.token).get('/api/commission/me').expect(200);
      expect(mine.body.charges.map((c) => [c.amount, c.welcome])).toEqual(expect.arrayContaining([[0, true], [600, false]]));
      expect(mine.body.summary).toMatchObject({ charged: 600, welcomeTripsLeft: 0 });
      expect(mine.body.rules).toMatchObject({ welcomeTrips: 1 });
    } finally {
      process.env.COMMISSION_WELCOME_TRIPS = '0';
    }
  });

  it("doesn't charge a trip booked before fees started", async () => {
    process.env.COMMISSION_START_DATE = '2099-01-01';
    try {
      const trip = await bookedTrip(15000);
      const seen = await as(trip.owner.token).get(`/api/bookings/${trip.booking._id}/payments`).expect(200);
      expect(seen.body.commission).toBeNull();
      await deliver(trip);
      expect(await CommissionCharge().countDocuments()).toBe(0);
    } finally {
      process.env.COMMISSION_START_DATE = '2000-01-01';
    }
  });

  it('tells an owner the fee on a fare before they offer, and only the amount', async () => {
    const owner = await newUser('owner');
    const res = await as(owner.token).get('/api/commission/estimate?fare=60000').expect(200);
    expect(res.body).toEqual({ success: true, fare: 60000, amount: 1800, reason: null });

    process.env.COMMISSION_WELCOME_TRIPS = '2';
    try {
      const welcome = await as(owner.token).get('/api/commission/estimate?fare=60000').expect(200);
      expect(welcome.body).toMatchObject({ amount: 0, reason: 'welcome' });
    } finally {
      process.env.COMMISSION_WELCOME_TRIPS = '0';
    }

    process.env.COMMISSION_START_DATE = '2099-01-01';
    try {
      const early = await as(owner.token).get('/api/commission/estimate?fare=60000').expect(200);
      expect(early.body).toMatchObject({ amount: 0, reason: 'notStarted' });
    } finally {
      process.env.COMMISSION_START_DATE = '2000-01-01';
    }

    await as(owner.token).get('/api/commission/estimate?fare=abc').expect(400);
  });

  it('is only for truck owners', async () => {
    const shipper = await newUser('shipper');
    await as(shipper.token).get('/api/commission/me').expect(403);
  });
});

describe('paying FLITO', () => {
  it("records a payment into FLITO's account, which counts once an admin confirms it", async () => {
    const admin = await newAdmin();
    const trip = await bookedTrip(15000);
    await deliver(trip);

    const accounts = await as(admin.token).post('/api/admin/commission/accounts')
      .field('kind', 'esewa').field('accountName', 'FLITO Pvt. Ltd.').field('walletId', '9801111111')
      .attach('qr', Buffer.from('png'), { filename: 'qr.png', contentType: 'image/png' })
      .expect(201);
    const esewa = accounts.body.payoutMethods[0];
    expect(esewa.qrUrl).toContain('flito/payout/platform');

    const mine = await as(trip.owner.token).get('/api/commission/me').expect(200);
    expect(mine.body.payTo).toEqual([expect.objectContaining({ kind: 'esewa', walletId: '9801111111', accountName: 'FLITO Pvt. Ltd.' })]);

    const tooMuch = await pay(trip.owner, { amount: 900, method: 'esewa' }).expect(400);
    expect(tooMuch.body).toMatchObject({ code: 'COMMISSION_MORE_THAN_OWED', extra: { max: 600 } });

    const reported = await pay(trip.owner, { amount: 600, method: 'bank', payoutMethodId: esewa._id, transactionId: 'ESW99' }).expect(201);
    expect(reported.body.payments[0]).toMatchObject({ amount: 600, method: 'esewa', paidTo: 'eSewa 9801111111', status: 'reported' });
    expect(reported.body.summary).toMatchObject({ awaiting: 600, paid: 0, maxPayment: 0 });

    const queue = await as(admin.token).get('/api/admin/commission/payments').expect(200);
    expect(queue.body.payments).toHaveLength(1);
    expect(queue.body.payments[0].owner._id).toBe(trip.owner.id);

    await as(admin.token).post(`/api/admin/commission/payments/${queue.body.payments[0]._id}/confirm`).expect(200);
    await as(admin.token).post(`/api/admin/commission/payments/${queue.body.payments[0]._id}/confirm`).expect(400);

    const after = await as(trip.owner.token).get('/api/commission/me').expect(200);
    expect(after.body.summary).toMatchObject({ paid: 600, balance: 0, awaiting: 0 });
    expect(after.body.payments[0].status).toBe('confirmed');
  });

  it('needs a reason to reject a payment, and tells the owner', async () => {
    const admin = await newAdmin();
    const trip = await bookedTrip(15000);
    await deliver(trip);
    const payment = (await pay(trip.owner, { amount: 600, method: 'cash' }).expect(201)).body.payments[0];

    await as(admin.token).post(`/api/admin/commission/payments/${payment._id}/reject`).send({ reason: 'no' }).expect(400);
    await as(admin.token).post(`/api/admin/commission/payments/${payment._id}/reject`)
      .send({ reason: 'Nothing came into the FLITO account' }).expect(200);

    const after = await as(trip.owner.token).get('/api/commission/me').expect(200);
    expect(after.body.payments[0]).toMatchObject({ status: 'rejected', rejectionReason: 'Nothing came into the FLITO account' });
    expect(after.body.summary).toMatchObject({ balance: 600, awaiting: 0, maxPayment: 600 });
  });

  it("lets only admins change FLITO's accounts", async () => {
    const owner = await newUser('owner');
    await as(owner.token).post('/api/admin/commission/accounts').field('kind', 'esewa').expect(403);
  });
});

describe('fees past due', () => {
  // A fee from a month that ended long ago, unpaid.
  const overdueFee = (owner, amount = 600) => CommissionCharge().create({
    ownerId: owner.id, bookingId: new (require('mongoose').Types.ObjectId)(), fare: 30000, rate: 0.02, amount, completedDay: '2026-06-01', period: '2083-02',
  });

  it('stop new offers until paid, and the admin sees who owes', async () => {
    const admin = await newAdmin();
    const owner = await newUser('owner');
    const shipper = await newUser('shipper');
    await overdueFee(owner);
    const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;

    const refused = await quoteOn(owner, load, 15000);
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'COMMISSION_OVERDUE', extra: { amount: 600 } });

    const overview = await as(admin.token).get('/api/admin/commission/overview').expect(200);
    expect(overview.body.totals).toMatchObject({ owed: 600, overdue: 600, ownersOverdue: 1 });
    expect(overview.body.owners[0]).toMatchObject({ overdue: 600, blocked: true, owner: expect.objectContaining({ _id: owner.id }) });

    const userPage = await as(admin.token).get(`/api/admin/users/${owner.id}`).expect(200);
    expect(userPage.body.user.commission).toMatchObject({ overdue: 600, blocked: true });

    // Recording the payment is enough to carry on while an admin checks it.
    await pay(owner, { amount: 600, method: 'cash' }).expect(201);
    const placed = await quoteOn(owner, load, 15000);
    expect(placed.status).toBe(201);
  });
});
