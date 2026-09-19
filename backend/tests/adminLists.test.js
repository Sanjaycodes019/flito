// The admin dashboard's lists: users, loads, bookings and the two review
// queues. All of them are newest-first and paginated the same way.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(() => false),
  uploadImages: jest.fn(),
  uploadPrivateDocument: jest.fn(),
  privateDocumentUrl: jest.fn(),
  deleteAssets: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const {
  setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone, sampleLoad, placeQuote, addTruck,
} = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const User = () => mongoose.model('User');
const Load = () => mongoose.model('Load');
const Truck = () => mongoose.model('Truck');

// Timestamps a minute apart, so "newest first" has an unambiguous answer.
const BASE = Date.UTC(2026, 0, 1);
const minutesAfterBase = (n) => new Date(BASE + n * 60 * 1000);

// Signed up an hour before everyone else the tests create, so it is always the
// oldest user.
const newAdmin = async () => {
  const admin = await User().create({
    phone: uniquePhone(), role: 'admin', firstName: 'Sita', isPhoneVerified: true, createdAt: minutesAfterBase(-60),
  });
  const token = jwt.sign({ userId: admin._id, phone: admin.phone, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { id: String(admin._id), token };
};

const makeUsers = (count, overrides = () => ({})) => Promise.all(
  Array.from({ length: count }, (_, i) => User().create({
    phone: uniquePhone(),
    role: 'shipper',
    firstName: `User${i}`,
    createdAt: minutesAfterBase(i),
    ...overrides(i),
  }))
);

describe('who can use the admin lists', () => {
  const LISTS = ['users', 'loads', 'bookings', 'kyc/pending', 'trucks/pending'];

  it.each(LISTS)('refuses a non-admin on /admin/%s', async (list) => {
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    expect((await as(shipper.token).get(`/api/admin/${list}`)).status).toBe(403);
  });

  it.each(LISTS)('refuses a request with no token on /admin/%s', async (list) => {
    expect((await request(app()).get(`/api/admin/${list}`)).status).toBe(401);
  });
});

describe('GET /api/admin/users', () => {
  it('lists users newest first, ten to a page, with the paging details', async () => {
    const admin = await newAdmin();
    await makeUsers(25);

    const page1 = (await as(admin.token).get('/api/admin/users?limit=10').expect(200)).body;
    expect(page1.pagination).toEqual({ page: 1, limit: 10, total: 26, totalPages: 3 });
    expect(page1.users).toHaveLength(10);
    // The admin (created first) is the oldest of the 26, so lands on the last page.
    expect(page1.users[0].firstName).toBe('User24');
    expect(page1.users[9].firstName).toBe('User15');

    const page3 = (await as(admin.token).get('/api/admin/users?limit=10&page=3').expect(200)).body;
    expect(page3.pagination.page).toBe(3);
    expect(page3.users).toHaveLength(6);
    expect(page3.users[5].role).toBe('admin');
  });

  it('never repeats or skips a user across pages', async () => {
    const admin = await newAdmin();
    await makeUsers(12);

    const ids = [];
    for (const page of [1, 2, 3]) {
      const { users } = (await as(admin.token).get(`/api/admin/users?limit=5&page=${page}`).expect(200)).body;
      ids.push(...users.map((u) => u._id));
    }
    expect(ids).toHaveLength(13);
    expect(new Set(ids).size).toBe(13);
  });

  it('applies sensible defaults and limits to the paging query', async () => {
    const admin = await newAdmin();
    await makeUsers(3);

    const defaults = (await as(admin.token).get('/api/admin/users').expect(200)).body.pagination;
    expect(defaults).toEqual({ page: 1, limit: 20, total: 4, totalPages: 1 });

    expect((await as(admin.token).get('/api/admin/users?limit=1000').expect(200)).body.pagination.limit).toBe(50);
    expect((await as(admin.token).get('/api/admin/users?limit=0').expect(200)).body.pagination.limit).toBe(20);
    expect((await as(admin.token).get('/api/admin/users?page=0').expect(200)).body.pagination.page).toBe(1);
    expect((await as(admin.token).get('/api/admin/users?page=abc&limit=xyz').expect(200)).body.pagination)
      .toMatchObject({ page: 1, limit: 20 });
  });

  it('returns an empty page, not an error, past the last one', async () => {
    const admin = await newAdmin();

    const res = (await as(admin.token).get('/api/admin/users?page=9').expect(200)).body;
    expect(res.users).toEqual([]);
    expect(res.pagination).toMatchObject({ page: 9, total: 1, totalPages: 1 });
  });

  it('shows what an admin needs and nothing secret', async () => {
    const admin = await newAdmin();
    await User().create({
      email: 'ram@flito.test',
      password: 'TestPass123',
      role: 'owner',
      firstName: 'Ram',
      companyName: 'Ram Transport',
      pushToken: 'ExponentPushToken[secret]',
      kycStatus: 'approved',
      status: 'suspended',
      createdAt: minutesAfterBase(5),
    });

    const [ram] = (await as(admin.token).get('/api/admin/users').expect(200)).body.users;
    expect(ram).toMatchObject({
      email: 'ram@flito.test', role: 'owner', firstName: 'Ram', companyName: 'Ram Transport', kycStatus: 'approved', status: 'suspended',
    });
    expect(ram).not.toHaveProperty('password');
    expect(ram).not.toHaveProperty('pushToken');
    expect(ram).not.toHaveProperty('googleId');
    expect(ram).not.toHaveProperty('emailVerificationCode');
  });
});

describe('GET /api/admin/loads', () => {
  it('lists every load whatever its status, newest first, with the shipper', async () => {
    const admin = await newAdmin();
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper', firstName: 'Ram', lastName: 'Shrestha' });
    const statuses = ['open', 'quoted', 'booked', 'completed', 'cancelled', 'expired'];
    await Promise.all(statuses.map((status, i) => Load().create({
      shipperId: shipper.id, goodsType: `Goods ${status}`, status, createdAt: minutesAfterBase(i),
    })));

    const { loads, pagination } = (await as(admin.token).get('/api/admin/loads').expect(200)).body;
    expect(pagination.total).toBe(6);
    expect(loads.map((l) => l.status)).toEqual([...statuses].reverse());
    expect(loads[0].shipperId).toMatchObject({ firstName: 'Ram', lastName: 'Shrestha', verified: true });
    // Only whether the shipper is verified, never where their review stands.
    expect(loads[0].shipperId).not.toHaveProperty('kycStatus');
  });

  it('is paginated', async () => {
    const admin = await newAdmin();
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    await Promise.all(Array.from({ length: 12 }, (_, i) => Load().create({
      shipperId: shipper.id, goodsType: `Load ${i}`, createdAt: minutesAfterBase(i),
    })));

    const page2 = (await as(admin.token).get('/api/admin/loads?limit=5&page=2').expect(200)).body;
    expect(page2.pagination).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 });
    expect(page2.loads.map((l) => l.goodsType)).toEqual(['Load 6', 'Load 5', 'Load 4', 'Load 3', 'Load 2']);
  });
});

describe('GET /api/admin/bookings', () => {
  const bookOne = async () => {
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper', firstName: 'Ram' });
    const owner = await signUp({ phone: uniquePhone(), role: 'owner', firstName: 'Bikash' });
    const driver = await signUp({ phone: uniquePhone(), role: 'driver', firstName: 'Hari' });

    const load = (await as(shipper.token).post('/api/loads').send(sampleLoad({ goodsType: 'Rice' })).expect(201)).body.load;
    const truck = await addTruck(owner);
    const quote = await placeQuote(owner, load, 15000, truck);
    const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
    await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver.id }).expect(200);
    return { booking, truck };
  };

  it('shows a booking an admin is not a party to, with everyone and the truck', async () => {
    const admin = await newAdmin();
    const { booking, truck } = await bookOne();

    const { bookings, pagination } = (await as(admin.token).get('/api/admin/bookings').expect(200)).body;
    expect(pagination.total).toBe(1);
    expect(bookings[0]._id).toBe(booking._id);
    expect(bookings[0]).toMatchObject({
      totalAmount: 15000,
      loadId: { goodsType: 'Rice' },
      shipperId: { firstName: 'Ram' },
      ownerId: { firstName: 'Bikash' },
      driverId: { firstName: 'Hari' },
      truckId: { registrationNumber: truck.registrationNumber },
    });
    expect(bookings[0].shipperId).not.toHaveProperty('kycStatus');
  });

  it('is empty, not an error, when nothing has been booked', async () => {
    const admin = await newAdmin();

    const res = (await as(admin.token).get('/api/admin/bookings').expect(200)).body;
    expect(res.bookings).toEqual([]);
    expect(res.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 1 });
  });
});

describe('PATCH /api/admin/users/:id/status', () => {
  const setStatus = (admin, userId, status) => as(admin.token).patch(`/api/admin/users/${userId}/status`).send({ status });

  it('suspends a user, and their existing session stops working at once', async () => {
    const admin = await newAdmin();
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper', firstName: 'Ram' });
    expect((await as(shipper.token).get('/api/auth/me')).status).toBe(200);

    const res = await setStatus(admin, shipper.id, 'suspended').expect(200);
    expect(res.body.user).toMatchObject({ _id: shipper.id, firstName: 'Ram', status: 'suspended' });
    // Only what the users list shows, never the rest of the account.
    expect(res.body.user).not.toHaveProperty('kycDocuments');
    expect(res.body.user).not.toHaveProperty('pushToken');

    const blocked = await as(shipper.token).get('/api/auth/me');
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'AUTH_ACCOUNT_STATUS', message: 'Account is suspended', extra: { status: 'suspended' } });
  });

  it('bans a user just the same', async () => {
    const admin = await newAdmin();
    const driver = await signUp({ phone: uniquePhone(), role: 'driver' });

    await setStatus(admin, driver.id, 'banned').expect(200);

    const blocked = await as(driver.token).get('/api/bookings');
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('Account is banned');
  });

  it('lets a reactivated user carry on with the same session', async () => {
    const admin = await newAdmin();
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    await setStatus(admin, shipper.id, 'suspended').expect(200);
    expect((await as(shipper.token).get('/api/auth/me')).status).toBe(403);

    await setStatus(admin, shipper.id, 'active').expect(200);

    expect((await as(shipper.token).get('/api/auth/me')).status).toBe(200);
  });

  it("won't let an admin change their own account's status", async () => {
    const admin = await newAdmin();

    const res = await setStatus(admin, admin.id, 'suspended');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ADMIN_CANNOT_CHANGE_OWN_STATUS');
    expect((await as(admin.token).get('/api/admin/stats')).status).toBe(200);
  });

  it('rejects an unknown status and an unknown user', async () => {
    const admin = await newAdmin();
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });

    expect((await setStatus(admin, shipper.id, 'deleted')).status).toBe(400);
    expect((await setStatus(admin, new mongoose.Types.ObjectId(), 'suspended')).status).toBe(404);
  });

  it('is for admins only', async () => {
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    const other = await signUp({ phone: uniquePhone(), role: 'shipper' });

    expect((await setStatus(shipper, other.id, 'banned')).status).toBe(403);
  });

  it('turns away a token whose account no longer exists', async () => {
    const shipper = await signUp({ phone: uniquePhone(), role: 'shipper' });
    await User().deleteOne({ _id: shipper.id });

    const res = await as(shipper.token).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID_TOKEN');
  });
});

describe('the review queues', () => {
  it('lists pending KYC submissions newest first and paginated', async () => {
    const admin = await newAdmin();
    await makeUsers(7, (i) => ({ kycStatus: 'pending', kycSubmittedAt: minutesAfterBase(i) }));
    // Not waiting on a review, so not in the queue.
    await makeUsers(2, () => ({ kycStatus: 'approved', kycSubmittedAt: minutesAfterBase(100) }));

    const page1 = (await as(admin.token).get('/api/admin/kyc/pending?limit=5').expect(200)).body;
    expect(page1.pagination).toEqual({ page: 1, limit: 5, total: 7, totalPages: 2 });
    expect(page1.users.map((u) => u.firstName)).toEqual(['User6', 'User5', 'User4', 'User3', 'User2']);

    const page2 = (await as(admin.token).get('/api/admin/kyc/pending?limit=5&page=2').expect(200)).body;
    expect(page2.users.map((u) => u.firstName)).toEqual(['User1', 'User0']);
  });

  it('shrinks the pending KYC total when a submission is decided', async () => {
    const admin = await newAdmin();
    const [oldest] = await makeUsers(3, (i) => ({ kycStatus: 'pending', kycSubmittedAt: minutesAfterBase(i) }));

    await as(admin.token).patch(`/api/admin/kyc/${oldest._id}`).send({ decision: 'approved' }).expect(200);

    const { users, pagination } = (await as(admin.token).get('/api/admin/kyc/pending').expect(200)).body;
    expect(pagination.total).toBe(2);
    expect(users.map((u) => u.firstName)).toEqual(['User2', 'User1']);
    expect((await as(admin.token).get('/api/admin/stats').expect(200)).body.stats.pendingKyc).toBe(2);
  });

  it('lists pending trucks newest first and paginated', async () => {
    const admin = await newAdmin();
    const owner = await signUp({ phone: uniquePhone(), role: 'owner', firstName: 'Bikash' });
    const trucks = [];
    for (let i = 0; i < 6; i += 1) trucks.push(await addTruck(owner));
    // Four wait on review, oldest submitted first; the others don't.
    await Promise.all(trucks.slice(0, 4).map((truck, i) => Truck().updateOne(
      { _id: truck._id },
      { verificationStatus: 'pending', verificationSubmittedAt: minutesAfterBase(i) },
    )));

    const page1 = (await as(admin.token).get('/api/admin/trucks/pending?limit=3').expect(200)).body;
    expect(page1.pagination).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(page1.trucks.map((t) => t.registrationNumber))
      .toEqual([trucks[3], trucks[2], trucks[1]].map((t) => t.registrationNumber));
    expect(page1.trucks[0].owner).toMatchObject({ firstName: 'Bikash' });

    const page2 = (await as(admin.token).get('/api/admin/trucks/pending?limit=3&page=2').expect(200)).body;
    expect(page2.trucks.map((t) => t.registrationNumber)).toEqual([trucks[0].registrationNumber]);
  });
});
