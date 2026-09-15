// Truck verification runs through the real routes, middleware and database;
// only Cloudinary is replaced, so no paper is ever sent to a live account.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(),
  uploadImages: jest.fn(),
  uploadAvatar: jest.fn(),
  uploadPrivateDocument: jest.fn(),
  privateDocumentUrl: jest.fn(),
  deleteAssets: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const storage = require('../src/services/storage');
const {
  setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, sampleLoad, addTruck, placeQuote,
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
    return { publicId: `${folder}/paper${counter}`, format: 'png', bytes: file.buffer.length };
  });
  storage.privateDocumentUrl.mockImplementation((publicId) =>
    `https://api.cloudinary.com/v1_1/demo/image/download?public_id=${encodeURIComponent(publicId)}&expires_at=9999999999`);
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const newUser = (role, extra = {}) => signUp({ phone: uniquePhone(), role, ...extra });

// Admins can't sign up publicly, so the suite creates one directly.
const newAdmin = async () => {
  const admin = await mongoose.model('User').create({ phone: uniquePhone(), role: 'admin', firstName: 'Sita', isPhoneVerified: true });
  const token = jwt.sign({ userId: admin._id, phone: admin.phone, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { id: String(admin._id), token };
};

const uploadPaper = (owner, truck, type) => as(owner.token)
  .post(`/api/trucks/${truck._id}/documents`)
  .field('type', type)
  .attach('document', PNG, { filename: 'paper.png', contentType: 'image/png' });

const submit = (owner, truck) => as(owner.token).post(`/api/trucks/${truck._id}/verification`);

const review = (admin, truck, body) => as(admin.token).patch(`/api/admin/trucks/${truck._id}`).send(body);

// An owner's truck with its required papers, sent for review.
const submittedTruck = async () => {
  const owner = await newUser('owner', { firstName: 'Bikash' });
  const truck = await addTruck(owner);
  await uploadPaper(owner, truck, 'bluebook').expect(201);
  await uploadPaper(owner, truck, 'truck_photo').expect(201);
  await submit(owner, truck).expect(200);
  return { owner, truck };
};

describe('an owner getting a truck verified', () => {
  it('uploads the bluebook and a photo of the truck, then submits them for review', async () => {
    const owner = await newUser('owner');
    const truck = await addTruck(owner);
    expect(truck.verified).toBe(false);
    expect(truck.verification).toMatchObject({ status: 'not_submitted', missingDocuments: ['bluebook', 'truck_photo'] });

    const early = await submit(owner, truck);
    expect(early.status).toBe(400);
    expect(early.body.missingDocuments).toEqual(['bluebook', 'truck_photo']);

    await uploadPaper(owner, truck, 'bluebook').expect(201);
    const { body } = await uploadPaper(owner, truck, 'truck_photo').expect(201);
    expect(body.truck.verification.missingDocuments).toEqual([]);
    expect(body.truck.verification.documents[0]).toMatchObject({ type: 'bluebook', url: expect.stringContaining('download') });
    // Storage identifiers never leave the server.
    expect(JSON.stringify(body.truck)).not.toMatch(/publicId/);

    const submitted = await submit(owner, truck).expect(200);
    expect(submitted.body.truck.verification).toMatchObject({ status: 'pending', canEdit: false });

    // Under review, the papers are locked.
    const late = await uploadPaper(owner, truck, 'insurance');
    expect(late.status).toBe(400);
    expect(late.body.message).toMatch(/under review/);
  });

  it("won't take papers for someone else's truck, or of an unknown kind", async () => {
    const owner = await newUser('owner');
    const other = await newUser('owner');
    const truck = await addTruck(owner);

    expect((await uploadPaper(other, truck, 'bluebook')).status).toBe(403);
    expect((await uploadPaper(owner, truck, 'selfie')).status).toBe(400);
    // Neither file reached storage.
    expect(storage.uploadPrivateDocument).not.toHaveBeenCalled();
  });
});

describe('an admin reviewing trucks', () => {
  it('lists trucks awaiting review with their owner and papers', async () => {
    const admin = await newAdmin();
    const { truck } = await submittedTruck();

    const { body } = await as(admin.token).get('/api/admin/trucks/pending').expect(200);

    expect(body.trucks).toHaveLength(1);
    expect(body.trucks[0]).toMatchObject({ registrationNumber: truck.registrationNumber, owner: { firstName: 'Bikash', verified: true } });
    expect(body.trucks[0].documents.map((doc) => doc.type).sort()).toEqual(['bluebook', 'truck_photo']);
    expect((await as(admin.token).get('/api/admin/stats').expect(200)).body.stats.pendingTrucks).toBe(1);
  });

  it('approves a truck, which then shows as verified wherever shippers see it', async () => {
    const admin = await newAdmin();
    const { owner, truck } = await submittedTruck();
    await review(admin, truck, { decision: 'approved' }).expect(200);

    const shipper = await newUser('shipper');
    const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;

    const { matches } = (await as(shipper.token).get(`/api/loads/${load._id}/matches`).expect(200)).body;
    expect(matches[0].truck.verified).toBe(true);
    expect(matches[0].owner.verified).toBe(true);

    const quote = await placeQuote(owner, load, 15000, truck);
    const { quotes } = (await as(shipper.token).get(`/api/loads/${load._id}/quotes`).expect(200)).body;
    expect(quotes[0].ownerId).toMatchObject({ firstName: 'Bikash', verified: true });
    expect(quotes[0].truckId).toMatchObject({ verified: true });

    const { booking } = (await as(shipper.token).patch(`/api/quotes/${quote._id}/accept`).expect(200)).body;
    const seen = (await as(shipper.token).get(`/api/bookings/${booking._id}`).expect(200)).body.booking;
    expect(seen.ownerId.verified).toBe(true);
    expect(seen.shipperId.verified).toBe(true);
    expect(seen.truckId.verified).toBe(true);

    // Only whether someone is verified, never where their verification stands.
    for (const party of [quotes[0].ownerId, seen.ownerId, seen.shipperId]) {
      expect(party.kycStatus).toBeUndefined();
    }
    expect(seen.truckId.verificationStatus).toBeUndefined();
  });

  it('shows an unverified person as not verified', async () => {
    const shipper = await newUser('shipper', { verified: false });
    const owner = await newUser('owner');
    await addTruck(owner);
    const load = (await as(shipper.token).post('/api/loads').send(sampleLoad()).expect(201)).body.load;

    const browse = (await as(owner.token).get('/api/loads').expect(200)).body.loads;
    expect(browse[0].shipperId).toMatchObject({ verified: false });
    expect(browse[0].shipperId.kycStatus).toBeUndefined();
    expect((await as(owner.token).get(`/api/loads/${load._id}`).expect(200)).body.load.shipperId.verified).toBe(false);
  });

  it('rejects with a reason the owner sees, and lets them fix the papers and resubmit', async () => {
    const admin = await newAdmin();
    const { owner, truck } = await submittedTruck();

    expect((await review(admin, truck, { decision: 'rejected' })).body.message).toMatch(/reason/);
    await review(admin, truck, { decision: 'rejected', reason: 'The bluebook photo is blurry' }).expect(200);

    const [mine] = (await as(owner.token).get('/api/trucks').expect(200)).body.trucks;
    expect(mine.verified).toBe(false);
    expect(mine.verification).toMatchObject({ status: 'rejected', rejectionReason: 'The bluebook photo is blurry', canEdit: true });

    await uploadPaper(owner, truck, 'bluebook').expect(201);
    // The replaced paper's file is deleted.
    expect(storage.deleteAssets).toHaveBeenCalledWith([expect.stringContaining('paper1')], { type: 'authenticated' });
    await submit(owner, truck).expect(200);
  });

  it('lets only admins decide, and only trucks awaiting review', async () => {
    const admin = await newAdmin();
    const { owner, truck } = await submittedTruck();

    expect((await as(owner.token).patch(`/api/admin/trucks/${truck._id}`).send({ decision: 'approved' })).status).toBe(403);
    await review(admin, truck, { decision: 'approved' }).expect(200);
    expect((await review(admin, truck, { decision: 'approved' })).status).toBe(400);
  });
});

describe('keeping the badge honest', () => {
  it('takes the badge away when a verified detail changes, but not for rates or features', async () => {
    const admin = await newAdmin();
    const { owner, truck } = await submittedTruck();
    await review(admin, truck, { decision: 'approved' }).expect(200);
    const edit = (body) => as(owner.token).patch(`/api/trucks/${truck._id}`).send(body).expect(200);

    expect((await edit({ ratePerKm: 95, features: { tarpaulin: true } })).body.truck.verified).toBe(true);
    // Sending a detail unchanged keeps the badge too.
    expect((await edit({ capacity: 10000, truckType: '6-wheeler' })).body.truck.verified).toBe(true);

    const changed = await edit({ capacity: 12000 });
    expect(changed.body.truck.verified).toBe(false);
    expect(changed.body.truck.verification).toMatchObject({ status: 'not_submitted', canEdit: true, missingDocuments: [] });
  });
});
