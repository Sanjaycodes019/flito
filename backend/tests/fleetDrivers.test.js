// Only Cloudinary is replaced, so no license photo is sent to a live account.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(),
  uploadImages: jest.fn(),
  uploadPrivateDocument: jest.fn(),
  privateDocumentUrl: jest.fn(),
  deleteAssets: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const storage = require('../src/services/storage');
const { isGuessablePin, newPin } = require('../src/services/pin');
const {
  setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone, sampleLoad, placeQuote,
} = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  storage.isConfigured.mockReturnValue(true);
  storage.deleteAssets.mockResolvedValue(undefined);
  let counter = 0;
  storage.uploadPrivateDocument.mockImplementation(async (file, { folder }) => {
    counter += 1;
    return { publicId: `${folder}/doc${counter}`, format: 'png', bytes: file.buffer.length };
  });
  storage.privateDocumentUrl.mockReturnValue('https://example.test/doc');
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const User = () => mongoose.model('User');

const newAdmin = async () => {
  const admin = await User().create({ phone: uniquePhone(), role: 'admin', firstName: 'Sita' });
  return { token: jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' }) };
};

const addDriver = async (owner, overrides = {}) => {
  const phone = overrides.phone || uniquePhone();
  const res = await as(owner.token).post('/api/users/me/drivers')
    .send({ firstName: 'Hari', lastName: 'Tamang', phone, ...overrides }).expect(201);
  return { ...res.body, phone };
};

const pinLogin = (phone, pin) => request(app()).post('/api/auth/pin-login').send({ phone, pin });
const uploadLicense = (owner, driverId) => as(owner.token)
  .post(`/api/users/me/drivers/${driverId}/license`)
  .attach('document', PNG, { filename: 'license.png', contentType: 'image/png' });

const wrongPin = (pin) => String((Number(pin) + 1) % 10000).padStart(4, '0');

describe('PINs', () => {
  it('never hands out an obvious PIN', () => {
    ['0000', '7777', '1234', '0123', '6789', '4321', '9876'].forEach((pin) => expect(isGuessablePin(pin)).toBe(true));
    for (let i = 0; i < 200; i += 1) {
      const pin = newPin();
      expect(pin).toMatch(/^\d{4}$/);
      expect(isGuessablePin(pin)).toBe(false);
    }
  });
});

describe('an owner adding a driver', () => {
  it('creates the driver with a PIN they can log in with by phone', async () => {
    const owner = await signUp({ role: 'owner' });
    const { driver, pin, phone } = await addDriver(owner);

    expect(pin).toMatch(/^\d{4}$/);
    expect(driver).toMatchObject({ firstName: 'Hari', phone, kycStatus: 'not_submitted', hasLicense: false });
    expect(driver.pin).toBeUndefined();

    const res = await pinLogin(phone, pin).expect(200);
    expect(res.body.user).toMatchObject({ role: 'driver', firstName: 'Hari', phone });
    expect(res.body.user.pin).toBeUndefined();
    expect(res.body.token).toBeTruthy();
  });

  it("lists only that owner's drivers", async () => {
    const owner = await signUp({ role: 'owner' });
    const otherOwner = await signUp({ role: 'owner' });
    await addDriver(owner);
    await addDriver(otherOwner);

    const { drivers } = (await as(owner.token).get('/api/users/me/drivers').expect(200)).body;
    expect(drivers).toHaveLength(1);
    expect(drivers[0].pin).toBeUndefined();
  });

  it('only lets owners add drivers', async () => {
    const shipper = await signUp({ role: 'shipper' });
    await as(shipper.token).post('/api/users/me/drivers')
      .send({ firstName: 'Hari', phone: uniquePhone() }).expect(403);
  });

  it('needs a name and a valid phone number', async () => {
    const owner = await signUp({ role: 'owner' });
    await as(owner.token).post('/api/users/me/drivers').send({ firstName: ' ', phone: uniquePhone() }).expect(400);
    await as(owner.token).post('/api/users/me/drivers').send({ firstName: 'Hari', phone: '9800000000' }).expect(400);
  });

  it('points to assigning by phone when the driver already has an account', async () => {
    const owner = await signUp({ role: 'owner' });
    const phone = uniquePhone();
    await signUp({ role: 'driver', phone });

    const res = await as(owner.token).post('/api/users/me/drivers').send({ firstName: 'Hari', phone }).expect(409);
    expect(res.body.code).toBe('DRIVERS_ALREADY_REGISTERED');
  });

  it('refuses a number that belongs to someone who is not a driver', async () => {
    const owner = await signUp({ role: 'owner' });
    const phone = uniquePhone();
    await signUp({ role: 'shipper', phone });

    const res = await as(owner.token).post('/api/users/me/drivers').send({ firstName: 'Hari', phone }).expect(409);
    expect(res.body.code).toBe('AUTH_PHONE_IN_USE');
  });
});

describe('PIN login', () => {
  it('gives the same answer for an unknown number and a wrong PIN', async () => {
    const owner = await signUp({ role: 'owner' });
    const { pin, phone } = await addDriver(owner);

    const unknown = await pinLogin(uniquePhone(), pin).expect(401);
    const wrong = await pinLogin(phone, wrongPin(pin)).expect(401);
    expect(unknown.body.code).toBe('AUTH_INVALID_PIN');
    expect(wrong.body.code).toBe('AUTH_INVALID_PIN');
  });

  it('does not work for accounts without a PIN', async () => {
    const phone = uniquePhone();
    await signUp({ role: 'driver', phone });
    await pinLogin(phone, '5824').expect(401);
  });

  it('locks after 5 wrong PINs, even for the right one', async () => {
    const owner = await signUp({ role: 'owner' });
    const { pin, phone } = await addDriver(owner);

    for (let i = 0; i < 5; i += 1) await pinLogin(phone, wrongPin(pin)).expect(401);

    const res = await pinLogin(phone, pin).expect(429);
    expect(res.body.code).toBe('AUTH_PIN_LOCKED');
    expect(res.body.extra.minutes).toBe(15);
  });

  it('makes each lock longer than the last', async () => {
    const owner = await signUp({ role: 'owner' });
    const { pin, phone } = await addDriver(owner);
    // As if the first lock had already run out.
    await User().updateOne({ phone }, { pinFailedAttempts: 5, pinLockedUntil: new Date(Date.now() - 1000) });

    for (let i = 0; i < 5; i += 1) await pinLogin(phone, wrongPin(pin)).expect(401);

    const res = await pinLogin(phone, pin).expect(429);
    expect(res.body.extra.minutes).toBe(30);
  });

  it('clears the wrong-PIN count after a correct PIN', async () => {
    const owner = await signUp({ role: 'owner' });
    const { pin, phone } = await addDriver(owner);

    for (let i = 0; i < 4; i += 1) await pinLogin(phone, wrongPin(pin)).expect(401);
    await pinLogin(phone, pin).expect(200);
    await pinLogin(phone, wrongPin(pin)).expect(401);
    await pinLogin(phone, pin).expect(200);
  });
});

describe('a new PIN from the owner', () => {
  it('replaces the old PIN and lifts a lock', async () => {
    const owner = await signUp({ role: 'owner' });
    const { driver, pin, phone } = await addDriver(owner);
    for (let i = 0; i < 5; i += 1) await pinLogin(phone, wrongPin(pin)).expect(401);

    const { pin: fresh } = (await as(owner.token).post(`/api/users/me/drivers/${driver._id}/pin`).expect(200)).body;

    await pinLogin(phone, fresh).expect(200);
    if (fresh !== pin) await pinLogin(phone, pin).expect(401);
  });

  it("can't be made for another owner's driver", async () => {
    const owner = await signUp({ role: 'owner' });
    const otherOwner = await signUp({ role: 'owner' });
    const { driver } = await addDriver(owner);

    await as(otherOwner.token).post(`/api/users/me/drivers/${driver._id}/pin`).expect(404);
  });
});

describe('the driver license and verification', () => {
  it('sends the driver for admin review, naming the owner who added them', async () => {
    const owner = await signUp({ role: 'owner', firstName: 'Bikash' });
    const { driver } = await addDriver(owner);

    const res = await uploadLicense(owner, driver._id).expect(201);
    expect(res.body.driver).toMatchObject({ kycStatus: 'pending', hasLicense: true });

    const admin = await newAdmin();
    const queue = (await as(admin.token).get('/api/admin/kyc').expect(200)).body.users;
    expect(queue).toHaveLength(1);
    expect(queue[0].addedBy.name).toBe('Bikash User');
    expect(queue[0].identityDocuments).toContain('driving_license');
  });

  it('lets the owner send a new photo after a rejection, but not while under review', async () => {
    const owner = await signUp({ role: 'owner' });
    const { driver } = await addDriver(owner);
    await uploadLicense(owner, driver._id).expect(201);

    const locked = await uploadLicense(owner, driver._id).expect(400);
    expect(locked.body.code).toBe('DRIVERS_LICENSE_LOCKED');

    const admin = await newAdmin();
    await as(admin.token).patch(`/api/admin/kyc/${driver._id}`).send({ decision: 'rejected', reason: 'Photo is blurry' }).expect(200);
    const { drivers } = (await as(owner.token).get('/api/users/me/drivers').expect(200)).body;
    expect(drivers[0]).toMatchObject({ kycStatus: 'rejected', kycRejectionReason: 'Photo is blurry' });

    const { notifications } = (await as(owner.token).get('/api/users/me/notifications').expect(200)).body;
    expect(notifications[0].title).toBe('Driver license photo rejected');

    const again = await uploadLicense(owner, driver._id).expect(201);
    expect(again.body.driver.kycStatus).toBe('pending');
    expect(again.body.driver.kycRejectionReason).toBeUndefined();
    expect(storage.deleteAssets).toHaveBeenCalled(); // the old photo
  });

  it('can be put on a booking only once an admin approves', async () => {
    const shipper = await signUp({ role: 'shipper' });
    const owner = await signUp({ role: 'owner' });
    const { driver } = await addDriver(owner);
    await uploadLicense(owner, driver._id).expect(201);

    const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;
    const quote = await placeQuote(owner, load, 15000);
    const booking = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body.booking;

    const early = await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver._id }).expect(400);
    expect(early.body.code).toBe('DRIVER_NOT_VERIFIED');

    const admin = await newAdmin();
    await as(admin.token).patch(`/api/admin/kyc/${driver._id}`).send({ decision: 'approved' }).expect(200);

    await as(owner.token).patch(`/api/bookings/${booking._id}/assign-driver`).send({ driverId: driver._id }).expect(200);
  });
});
