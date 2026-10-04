// The admin pages for one record (a user, truck, booking or load): the
// record in full, the lists of what belongs to it, the actions an admin can
// take on it, and the history of those actions.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(() => false),
  uploadImages: jest.fn(),
  uploadPrivateDocument: jest.fn(),
  privateDocumentUrl: jest.fn(),
  deleteAssets: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, placeQuote, addTruck,
} = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const User = () => require('../src/models/User');
const Load = () => require('../src/models/Load');
const Truck = () => require('../src/models/Truck');
const Quote = () => require('../src/models/Quote');

const newAdmin = async () => {
  const admin = await User().create({ phone: uniquePhone(), role: 'admin', firstName: 'Sita', lastName: 'Admin' });
  const token = jwt.sign({ userId: admin._id, phone: admin.phone, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { id: String(admin._id), token };
};

const newUser = (role, extra = {}) => signUp({ phone: uniquePhone(), role, ...extra });
const postLoad = async (shipper, overrides) =>
  (await as(shipper.token).post('/api/loads').send(sampleLoad(overrides)).expect(201)).body.load;

// A shipper's load booked on an owner's truck.
const bookedJob = async () => {
  const shipper = await newUser('shipper', { firstName: 'Ram' });
  const owner = await newUser('owner', { firstName: 'Bikash' });
  const truck = await addTruck(owner);
  const load = await postLoad(shipper);
  const quote = await placeQuote(owner, load, 15000, truck);
  const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
  return { shipper, owner, truck, load, quote, booking };
};

describe('a user in full', () => {
  it('shows their profile, sign-in methods and verification, and never a secret', async () => {
    const admin = await newAdmin();
    const owner = await newUser('owner', { firstName: 'Bikash' });
    await User().updateOne({ _id: owner.id }, {
      companyName: 'Bikash Transport',
      bankDetails: { bankName: 'Nabil Bank', accountNumber: '0123456789012' },
      pushToken: 'ExponentPushToken[secret]',
    });

    const { user, counts, history } = (await as(admin.token).get(`/api/admin/users/${owner.id}`).expect(200)).body;

    expect(user).toMatchObject({
      _id: owner.id, name: 'Bikash User', role: 'owner', companyName: 'Bikash Transport', status: 'active',
      bank: { bankName: 'Nabil Bank', account: '•••• 9012' },
      signIn: { password: true, pin: false, google: false },
      pushEnabled: true,
      kyc: expect.objectContaining({ status: 'approved', documents: [] }),
    });
    const text = JSON.stringify(user);
    // Password and PIN show only as whether they are set, never their bcrypt hash.
    for (const secret of ['$2a$', '$2b$', 'ExponentPushToken', '0123456789012', 'emailVerificationCode']) {
      expect(text).not.toContain(secret);
    }
    expect(counts).toEqual({ bookings: 0, activeBookings: 0, completedBookings: 0, trucks: 0, verifiedTrucks: 0, drivers: 0 });
    expect(history).toEqual([]);
  });

  it('counts what an owner and a shipper touch, and lists it page by page', async () => {
    const admin = await newAdmin();
    const { shipper, owner, truck, load } = await bookedJob();
    await postLoad(shipper);
    const other = await bookedJob();

    const ownerPage = (await as(admin.token).get(`/api/admin/users/${owner.id}`).expect(200)).body;
    expect(ownerPage.counts).toMatchObject({ bookings: 1, activeBookings: 1, trucks: 1 });
    const shipperPage = (await as(admin.token).get(`/api/admin/users/${shipper.id}`).expect(200)).body;
    expect(shipperPage.counts).toMatchObject({ bookings: 1, loads: 2, openLoads: 1 });

    const bookings = (await as(admin.token).get(`/api/admin/bookings?userId=${owner.id}`).expect(200)).body;
    expect(bookings.bookings.map((b) => b.truckId._id)).toEqual([truck._id]);
    expect(bookings.pagination.total).toBe(1);

    const trucks = (await as(admin.token).get(`/api/admin/trucks?ownerId=${owner.id}`).expect(200)).body.trucks;
    expect(trucks.map((t) => t._id)).toEqual([truck._id]);

    const loads = (await as(admin.token).get(`/api/admin/loads?shipperId=${shipper.id}&limit=1`).expect(200)).body;
    expect(loads.pagination).toMatchObject({ total: 2, totalPages: 2 });
    expect((await as(admin.token).get(`/api/admin/bookings?loadId=${load._id}`).expect(200)).body.pagination.total).toBe(1);
    expect((await as(admin.token).get(`/api/admin/bookings?truckId=${other.truck._id}`).expect(200)).body.pagination.total).toBe(1);
  });

  it("lists the drivers an owner added", async () => {
    const admin = await newAdmin();
    const owner = await newUser('owner');
    const driver = await User().create({ phone: uniquePhone(), role: 'driver', firstName: 'Hari', addedBy: owner.id });
    await User().create({ phone: uniquePhone(), role: 'driver', firstName: 'Someone else' });

    const { users } = (await as(admin.token).get(`/api/admin/users?addedBy=${owner.id}`).expect(200)).body;
    expect(users.map((u) => String(u._id))).toEqual([String(driver._id)]);
  });

  it('answers not found for an unknown or malformed id', async () => {
    const admin = await newAdmin();
    for (const path of ['users', 'trucks', 'bookings', 'loads']) {
      expect((await as(admin.token).get(`/api/admin/${path}/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
      expect((await as(admin.token).get(`/api/admin/${path}/not-an-id`)).status).toBe(404);
    }
  });

  it('is for admins only', async () => {
    const shipper = await newUser('shipper');
    expect((await as(shipper.token).get(`/api/admin/users/${shipper.id}`)).status).toBe(403);
  });
});

describe('the history of admin actions', () => {
  it('records who changed an account, and why', async () => {
    const admin = await newAdmin();
    const user = await newUser('shipper');

    await as(admin.token).patch(`/api/admin/users/${user.id}/status`).send({ status: 'suspended', reason: 'Fake loads reported' }).expect(200);
    await as(admin.token).patch(`/api/admin/users/${user.id}/status`).send({ status: 'suspended' }).expect(200);
    await as(admin.token).patch(`/api/admin/users/${user.id}/status`).send({ status: 'active' }).expect(200);
    await as(admin.token).post(`/api/admin/users/${user.id}/reset-pin`).expect(200);

    const { history } = (await as(admin.token).get(`/api/admin/users/${user.id}`).expect(200)).body;
    // Newest first; suspending an already suspended user changes nothing, so isn't recorded.
    expect(history.map((entry) => entry.action)).toEqual(['user.pinReset', 'user.reactivated', 'user.suspended']);
    expect(history[2]).toMatchObject({
      reason: 'Fake loads reported', meta: { from: 'active', to: 'suspended' }, by: { _id: admin.id, name: 'Sita Admin' },
    });
    expect(JSON.stringify(history)).not.toMatch(/"pin":/);
  });
});

describe('taking back a verification', () => {
  it("revokes a user's verification with a reason they are told", async () => {
    const admin = await newAdmin();
    const owner = await newUser('owner');
    const revoke = (body) => as(admin.token).post(`/api/admin/kyc/${owner.id}/revoke`).send(body);

    expect((await revoke({ reason: 'no' })).body.code).toBe('ADMIN_REASON_TOO_SHORT');
    const res = await revoke({ reason: 'Citizenship photo is not theirs' }).expect(200);
    expect(res.body.user).toMatchObject({ kycStatus: 'rejected', kycRejectionReason: 'Citizenship photo is not theirs' });

    // Only a verified user can be unverified.
    expect((await revoke({ reason: 'Again, for good measure' })).body.code).toBe('ADMIN_KYC_NOT_APPROVED');

    const { user, history } = (await as(admin.token).get(`/api/admin/users/${owner.id}`).expect(200)).body;
    expect(user.kyc).toMatchObject({ status: 'rejected', rejectionReason: 'Citizenship photo is not theirs', reviewedBy: { name: 'Sita Admin' } });
    expect(history[0]).toMatchObject({ action: 'kyc.revoked', reason: 'Citizenship photo is not theirs' });

    // The owner sees it on their own account, and can send documents again.
    const kyc = (await as(owner.token).get('/api/users/me/kyc').expect(200)).body.kyc;
    expect(kyc).toMatchObject({ status: 'rejected', canEdit: true });
  });

  it("records a review decision in the user's history", async () => {
    const admin = await newAdmin();
    const user = await newUser('shipper');
    await User().updateOne({ _id: user.id }, { kycStatus: 'pending' });

    await as(admin.token).patch(`/api/admin/kyc/${user.id}`).send({ decision: 'approved' }).expect(200);

    const { history } = (await as(admin.token).get(`/api/admin/users/${user.id}`).expect(200)).body;
    expect(history.map((entry) => entry.action)).toEqual(['kyc.approved']);
  });

  it("revokes a truck's verification, and the truck page shows why", async () => {
    const admin = await newAdmin();
    const owner = await newUser('owner');
    const truck = await addTruck(owner);
    await Truck().updateOne({ _id: truck._id }, { verificationStatus: 'approved' });

    await as(admin.token).post(`/api/admin/trucks/${truck._id}/revoke`).send({ reason: 'Insurance has expired' }).expect(200);

    const page = (await as(admin.token).get(`/api/admin/trucks/${truck._id}`).expect(200)).body;
    expect(page.truck.verification).toMatchObject({ status: 'rejected', rejectionReason: 'Insurance has expired' });
    expect(page.history[0]).toMatchObject({ action: 'truck.revoked' });
    expect((await as(admin.token).post(`/api/admin/trucks/${truck._id}/revoke`).send({ reason: 'Insurance has expired' })).status).toBe(400);
  });
});

describe('a truck in full', () => {
  it('shows its owner, driver, papers, booked days and bookings', async () => {
    const admin = await newAdmin();
    const { owner, truck, load } = await bookedJob();
    const driver = await User().create({ phone: uniquePhone(), role: 'driver', firstName: 'Hari' });
    await Truck().updateOne({ _id: truck._id }, {
      assignedDriverId: driver._id,
      chassisNumber: 'CH123',
      insurance: { company: 'Shikhar', validUntil: new Date('2027-01-01') },
      $push: { reservedDays: '2000-01-01' },
    });

    const { truck: page, counts } = (await as(admin.token).get(`/api/admin/trucks/${truck._id}`).expect(200)).body;

    expect(page).toMatchObject({
      registrationNumber: truck.registrationNumber,
      chassisNumber: 'CH123',
      insurance: expect.objectContaining({ company: 'Shikhar' }),
      owner: expect.objectContaining({ _id: owner.id, phone: expect.any(String) }),
      driver: expect.objectContaining({ _id: String(driver._id), name: 'Hari' }),
      base: expect.objectContaining({ district: 'Kathmandu' }),
      verification: expect.objectContaining({ status: 'not_submitted' }),
    });
    // Only the days from today on.
    expect(page.bookedDays).toEqual([load.pickupDay]);
    expect(counts).toEqual({ bookings: 1, activeBookings: 1, completedBookings: 0 });
  });
});

describe('a booking in full', () => {
  it('shows the job, everyone on it with their numbers, the price and the payment', async () => {
    const admin = await newAdmin();
    const { shipper, owner, truck, load, booking } = await bookedJob();

    const page = (await as(admin.token).get(`/api/admin/bookings/${booking._id}`).expect(200)).body.booking;

    expect(page).toMatchObject({
      status: booking.status,
      shipper: expect.objectContaining({ _id: shipper.id, phone: expect.any(String) }),
      owner: expect.objectContaining({ _id: owner.id }),
      truck: expect.objectContaining({ _id: truck._id, registrationNumber: truck.registrationNumber }),
      load: expect.objectContaining({ _id: load._id, goodsType: 'Cement', pickup: expect.objectContaining({ address: expect.any(String) }) }),
      offer: expect.objectContaining({ price: 15000, openedBy: 'owner', acceptedBy: 'shipper' }),
      payment: expect.objectContaining({ total: 15000, paid: 0, pending: 15000, records: [] }),
    });
  });

  it('lets an admin cancel it with a reason, freeing the truck and the load', async () => {
    const admin = await newAdmin();
    const { truck, load, booking } = await bookedJob();
    const cancel = (body) => as(admin.token).post(`/api/admin/bookings/${booking._id}/cancel`).send(body);

    expect((await cancel({})).body.code).toBe('ADMIN_REASON_TOO_SHORT');
    const res = await cancel({ reason: 'Shipper reported fraud' }).expect(200);

    expect(res.body.booking.status).toBe('cancelled');
    expect(res.body.history[0]).toMatchObject({ action: 'booking.cancelled', reason: 'Shipper reported fraud', meta: { from: booking.status } });
    expect((await Truck().findById(truck._id)).reservedDays).not.toContain(load.pickupDay);
    expect(await Load().findById(load._id)).toMatchObject({ status: 'open', trucksBooked: 0 });

    expect((await cancel({ reason: 'Shipper reported fraud' })).body.code).toBe('ADMIN_BOOKING_NOT_CANCELLABLE');
  });
});

describe('a load in full', () => {
  it('shows the shipper, every offer and the bookings', async () => {
    const admin = await newAdmin();
    const { shipper, load, booking } = await bookedJob();

    const page = (await as(admin.token).get(`/api/admin/loads/${load._id}`).expect(200)).body.load;

    expect(page).toMatchObject({
      goodsType: 'Cement', trucksNeeded: 1, trucksBooked: 1, status: 'booked',
      shipper: expect.objectContaining({ _id: shipper.id }),
      offers: [expect.objectContaining({ status: 'accepted', price: 15000 })],
      bookings: [expect.objectContaining({ _id: booking._id })],
    });
  });

  it('takes a load off the market with a reason, closing its open offers', async () => {
    const admin = await newAdmin();
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');
    const load = await postLoad(shipper);
    const quote = await placeQuote(owner, load, 15000);

    const res = await as(admin.token).post(`/api/admin/loads/${load._id}/cancel`).send({ reason: 'Prohibited goods' }).expect(200);

    expect(res.body.load.status).toBe('cancelled');
    expect(res.body.history[0]).toMatchObject({ action: 'load.cancelled', reason: 'Prohibited goods' });
    expect((await Quote().findById(quote._id)).status).toBe('rejected');
  });

  it('refuses to cancel a load that already has a truck booked', async () => {
    const admin = await newAdmin();
    const { load } = await bookedJob();
    const res = await as(admin.token).post(`/api/admin/loads/${load._id}/cancel`).send({ reason: 'Prohibited goods' });
    expect(res.body.code).toBe('ADMIN_LOAD_HAS_BOOKINGS');
  });
});
