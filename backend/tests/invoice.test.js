// The invoice for a completed trip: numbered when the driver completes it,
// downloaded as a one-page PDF by the shipper or owner through a short-lived
// link.
const jwt = require('jsonwebtoken');
const request = require('supertest');
const {
  setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone, sampleLoad, placeQuote,
} = require('./helpers');
const { fiscalYearOf } = require('../src/services/invoice');
const { renderInvoicePdf } = require('../src/services/invoicePdf');
const { amountInWords } = require('../src/utils/format');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const newUser = (role, extra = {}) => signUp({ phone: uniquePhone(), role, ...extra });

// A booking at `fare` between a new shipper and owner, with a driver on it.
const bookedTrip = async (fare = 15000) => {
  const shipper = await newUser('shipper');
  const owner = await newUser('owner');
  const driver = await newUser('driver');
  const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;
  const quote = await placeQuote(owner, load, fare);
  const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
  await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver.id }).expect(200);
  return { shipper, owner, driver, booking };
};

const deliver = async ({ driver, booking }) => {
  await as(driver.token).patch(`/api/bookings/${booking._id}/status`).send({ status: 'in_transit', pickupStatus: 'picked_up' }).expect(200);
  await as(driver.token).patch(`/api/bookings/${booking._id}/status`).send({ dropoffStatus: 'delivered', status: 'completed' }).expect(200);
};

// Fetches the PDF a link points to, as raw bytes.
const fetchPdf = (path) => request(app())
  .get(`/api${path}`)
  .buffer(true)
  .parse((res, done) => {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  });

const pageCount = (pdf) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;

describe('invoice numbers', () => {
  it('runs by Nepali fiscal year, which starts on 1 Shrawan', () => {
    // 1 Shrawan 2083 is 17 July 2026.
    expect(fiscalYearOf('2026-07-16')).toBe('2082-83');
    expect(fiscalYearOf('2026-07-17')).toBe('2083-84');
    expect(fiscalYearOf('2026-10-06')).toBe('2083-84');
  });

  it('numbers a trip when it is completed, one after another', async () => {
    const first = await bookedTrip();
    const second = await bookedTrip();
    await deliver(first);
    await deliver(second);

    const a = (await as(first.shipper.token).get(`/api/bookings/${first.booking._id}`).expect(200)).body.booking;
    const b = (await as(second.owner.token).get(`/api/bookings/${second.booking._id}`).expect(200)).body.booking;
    expect(a.invoice.number).toMatch(/^FL\/\d{4}-\d{2}\/00001$/);
    expect(b.invoice.number).toMatch(/^FL\/\d{4}-\d{2}\/00002$/);
    expect(a.completedAt).toBeTruthy();
  });
});

describe('downloading an invoice', () => {
  it('gives the shipper a link to a one-page PDF', async () => {
    const trip = await bookedTrip(25500);
    await deliver(trip);

    const link = (await as(trip.shipper.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(200)).body;
    expect(link.invoice.number).toMatch(/^FL\//);
    expect(link.fileName).toMatch(/^FLITO-Invoice-FL-\d{4}-\d{2}-00001\.pdf$/);

    const res = await fetchPdf(link.path).expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(link.fileName);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(res.body)).toBe(1);
  });

  it('works for the owner too, and keeps the same number', async () => {
    const trip = await bookedTrip();
    await deliver(trip);
    const fromShipper = (await as(trip.shipper.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(200)).body;
    const fromOwner = (await as(trip.owner.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(200)).body;
    expect(fromOwner.invoice.number).toBe(fromShipper.invoice.number);
  });

  it('is only for the shipper and the owner', async () => {
    const trip = await bookedTrip();
    await deliver(trip);
    const stranger = await newUser('shipper');
    await as(trip.driver.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(403);
    const res = await as(stranger.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(403);
    expect(res.body.code).toBe('INVOICE_NOT_PARTY');
  });

  it('waits until the trip is delivered', async () => {
    const trip = await bookedTrip();
    const res = await as(trip.shipper.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(400);
    expect(res.body.code).toBe('INVOICE_NOT_COMPLETED');
  });

  it('numbers a trip completed before invoices existed when it is first asked for', async () => {
    const trip = await bookedTrip();
    await deliver(trip);
    const Booking = require('../src/models/Booking');
    await Booking.updateOne({ _id: trip.booking._id }, { $unset: { invoice: 1, completedAt: 1 } });

    const link = (await as(trip.owner.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(200)).body;
    expect(link.invoice.number).toMatch(/\/00002$/);
  });

  it('refuses a link that is missing, for another booking, or a login token', async () => {
    const trip = await bookedTrip();
    const other = await bookedTrip();
    await deliver(trip);
    await deliver(other);

    await fetchPdf(`/bookings/${trip.booking._id}/invoice.pdf`).expect(401);

    const link = (await as(trip.shipper.token).post(`/api/bookings/${trip.booking._id}/invoice-link`).expect(200)).body;
    const token = new URL(link.path, 'http://x').searchParams.get('token');
    await fetchPdf(`/bookings/${other.booking._id}/invoice.pdf?token=${token}`).expect(401);

    // A login token isn't an invoice link...
    await fetchPdf(`/bookings/${trip.booking._id}/invoice.pdf?token=${trip.shipper.token}`).expect(401);
    // ...and an invoice link isn't a login token.
    await request(app()).get('/api/bookings').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('refuses an expired link', async () => {
    const trip = await bookedTrip();
    await deliver(trip);
    const expired = jwt.sign(
      { userId: trip.shipper.id, bookingId: String(trip.booking._id), exp: Math.floor(Date.now() / 1000) - 10 },
      `${process.env.JWT_SECRET}:invoice-link`,
    );
    const res = await fetchPdf(`/bookings/${trip.booking._id}/invoice.pdf?token=${expired}`).expect(401);
    expect(JSON.parse(res.body.toString()).code).toBe('INVOICE_LINK_EXPIRED');
  });
});

describe('the PDF', () => {
  // Everything at its longest, to show the layout never runs onto a second page.
  const crowded = {
    number: 'FL/2083-84/00042',
    issuedAt: new Date(),
    completedAt: new Date(),
    bookedAt: new Date(),
    reference: 'A1B2C3D4',
    owner: {
      name: 'A Very Long Transport Company Name Private Limited of Kathmandu Valley', contact: 'Bikash Bahadur Thapa Magar', phone: '+9779841234567', email: 'accounts.department@a-very-long-transport-company.com.np', address: 'Teku, Ward 12, Kathmandu Metropolitan City, Kathmandu, Bagmati Province, and then some more words',
    },
    shipper: {
      name: 'राम बहादुर श्रेष्ठ', contact: null, phone: '+9779801112233', email: 'ram@example.com', address: null,
    },
    trip: {
      pickup: { label: 'Basantapur, Kathmandu', address: 'Basantapur, Ward 20, Kathmandu Metropolitan City, Kathmandu, Bagmati Province', contact: 'Hari Prasad Sharma, +9779812345678' },
      dropoff: { label: 'Lakeside, Pokhara', address: 'Lakeside, Ward 6, Pokhara Metropolitan City, Kaski, Gandaki Province', contact: 'Sita, +9779800000000' },
      pickupDay: '2026-10-04',
      distanceKm: 203,
      goodsType: 'Construction materials and assorted hardware for a building site',
      description: 'x'.repeat(500),
      weight: 6000,
      truck: { registrationNumber: 'BA 2 KHA 1234', truckType: '6-wheeler', bodyType: 'refrigerated', makeModel: 'Tata Signa 1923.K Long Wheelbase' },
      driver: 'Suman Gurung',
    },
    amounts: { total: 1234567.5, paid: 600000, due: 634567.5 },
    payments: Array.from({ length: 8 }, (_, i) => ({
      date: new Date(), method: 'bank', reference: `REF-${i}-${'9'.repeat(30)}`, paidTo: 'Nabil Bank •••• 1234', amount: 75000,
    })),
    payTo: [{ kind: 'bank', bankName: 'Nepal Investment Mega Bank', accountName: 'A Very Long Transport Company Name', accountNumber: '01234567890123456789', branch: 'New Road' }],
    delivery: { signature: null, signedAt: null, photos: 0 },
  };

  it('stays on one page however much there is to show', async () => {
    const pdf = await renderInvoicePdf(crowded);
    expect(pageCount(pdf)).toBe(1);
  });
});

describe('amount in words', () => {
  it('counts in lakh and crore, with paisa', () => {
    expect(amountInWords(15000)).toBe('Nepalese Rupees Fifteen Thousand Only');
    expect(amountInWords(25500)).toBe('Nepalese Rupees Twenty-Five Thousand Five Hundred Only');
    expect(amountInWords(1234567.5)).toBe('Nepalese Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paisa Only');
    expect(amountInWords(120000000)).toBe('Nepalese Rupees Twelve Crore Only');
    expect(amountInWords(0)).toBe('Nepalese Rupees Zero Only');
  });
});
