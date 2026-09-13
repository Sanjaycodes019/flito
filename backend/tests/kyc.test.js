// KYC runs through the real routes, middleware and database; only Cloudinary is
// replaced, so no identity document is ever sent to a live account in tests.
jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(),
  uploadImages: jest.fn(),
  uploadPrivateDocument: jest.fn(),
  privateDocumentUrl: jest.fn(),
  deleteAssets: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const storage = require('../src/services/storage');
const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone } = require('./helpers');

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
    return {
      publicId: `${folder}/doc${counter}`,
      format: file.mimetype === 'application/pdf' ? 'pdf' : 'png',
      bytes: file.buffer.length,
    };
  });
  storage.privateDocumentUrl.mockImplementation((publicId) =>
    `https://api.cloudinary.com/v1_1/demo/image/download?public_id=${encodeURIComponent(publicId)}&expires_at=9999999999`);
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const User = () => mongoose.model('User');
// These tests drive verification themselves, so accounts start unverified.
const newUser = (role) => signUp({ phone: uniquePhone(), role, verified: false });

// Admins can't sign up publicly, so the suite creates one directly.
const newAdmin = async () => {
  const admin = await User().create({ phone: uniquePhone(), role: 'admin', firstName: 'Sita', isPhoneVerified: true });
  const token = jwt.sign({ userId: admin._id, phone: admin.phone, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { id: String(admin._id), token };
};

const uploadDoc = (actor, type, { contentType = 'image/png', buffer = PNG, filename = 'doc.png' } = {}) =>
  as(actor.token)
    .post('/api/users/me/kyc/documents')
    .field('type', type)
    .attach('document', buffer, { filename, contentType });

const uploadAll = async (actor, types) => {
  for (const type of types) {
    await uploadDoc(actor, type).expect(201);
  }
};

const myKyc = async (actor) => (await as(actor.token).get('/api/users/me/kyc').expect(200)).body.kyc;
const submit = (actor) => as(actor.token).post('/api/users/me/kyc/submit');
const review = (admin, user, body) => as(admin.token).patch(`/api/admin/kyc/${user.id}`).send(body);

describe('KYC status', () => {
  it('starts new accounts as not submitted and keeps them out of the review queue', async () => {
    const shipper = await newUser('shipper');
    const admin = await newAdmin();

    const me = await as(shipper.token).get('/api/auth/me').expect(200);
    expect(me.body.user.kycStatus).toBe('not_submitted');

    expect((await as(admin.token).get('/api/admin/kyc/pending').expect(200)).body.users).toEqual([]);
    expect((await as(admin.token).get('/api/admin/stats').expect(200)).body.stats.pendingKyc).toBe(0);
  });
});

describe('KYC documents', () => {
  it('stores documents privately and hands back only an expiring link', async () => {
    const shipper = await newUser('shipper');

    const res = await uploadDoc(shipper, 'citizenship_front').expect(201);

    const [doc] = res.body.kyc.documents;
    expect(doc.type).toBe('citizenship_front');
    expect(doc.url).toContain('expires_at=');
    expect(doc.publicId).toBeUndefined();
    expect(storage.uploadPrivateDocument).toHaveBeenCalledWith(expect.anything(), { folder: `flito/kyc/${shipper.id}` });

    // What's stored is a storage identifier, never a shareable URL.
    const stored = (await User().findById(shipper.id)).kycDocuments[0].toObject();
    expect(stored.publicId).toBe(`flito/kyc/${shipper.id}/doc1`);
    expect(stored.url).toBeUndefined();
  });

  it('accepts a PDF', async () => {
    const shipper = await newUser('shipper');
    const res = await uploadDoc(shipper, 'citizenship_front', {
      contentType: 'application/pdf', buffer: Buffer.from('%PDF-1.4'), filename: 'card.pdf',
    }).expect(201);
    expect(res.body.kyc.documents[0].format).toBe('pdf');
  });

  it('rejects files that are neither images nor PDFs', async () => {
    const shipper = await newUser('shipper');
    const res = await uploadDoc(shipper, 'citizenship_front', {
      contentType: 'text/plain', buffer: Buffer.from('hello'), filename: 'x.txt',
    });
    expect(res.status).toBe(400);
    expect(storage.uploadPrivateDocument).not.toHaveBeenCalled();
  });

  it('rejects a document over 10 MB', async () => {
    const shipper = await newUser('shipper');
    const res = await uploadDoc(shipper, 'citizenship_front', { buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/10 MB/);
    expect(storage.uploadPrivateDocument).not.toHaveBeenCalled();
  });

  it("rejects document types the account's role doesn't use", async () => {
    const shipper = await newUser('shipper');

    expect((await uploadDoc(shipper, 'driving_license')).status).toBe(400);
    expect((await uploadDoc(shipper, 'passport')).status).toBe(400);
    expect(storage.uploadPrivateDocument).not.toHaveBeenCalled();
  });

  it('replaces a document of the same type and deletes the old file', async () => {
    const shipper = await newUser('shipper');
    await uploadDoc(shipper, 'citizenship_front').expect(201);

    const res = await uploadDoc(shipper, 'citizenship_front').expect(201);

    expect(res.body.kyc.documents).toHaveLength(1);
    expect(storage.deleteAssets).toHaveBeenCalledWith([`flito/kyc/${shipper.id}/doc1`], { type: 'authenticated' });
  });

  it('removes a document and its file', async () => {
    const shipper = await newUser('shipper');
    const { documents } = (await uploadDoc(shipper, 'citizenship_front').expect(201)).body.kyc;

    const res = await as(shipper.token).delete(`/api/users/me/kyc/documents/${documents[0]._id}`).expect(200);

    expect(res.body.kyc.documents).toEqual([]);
    expect(storage.deleteAssets).toHaveBeenCalledWith([`flito/kyc/${shipper.id}/doc1`], { type: 'authenticated' });
  });

  it('answers 503 when storage is not configured', async () => {
    storage.isConfigured.mockReturnValue(false);
    const shipper = await newUser('shipper');
    expect((await uploadDoc(shipper, 'citizenship_front')).status).toBe(503);
  });

  it("never shows one user's documents to another", async () => {
    const alice = await newUser('shipper');
    const bob = await newUser('shipper');
    await uploadDoc(alice, 'citizenship_front').expect(201);

    expect((await myKyc(bob)).documents).toEqual([]);
  });
});

describe('KYC submission and review', () => {
  it('refuses to submit until every required document is uploaded', async () => {
    const driver = await newUser('driver');
    await uploadAll(driver, ['citizenship_front', 'citizenship_back']);

    const res = await submit(driver);

    expect(res.status).toBe(400);
    expect(res.body.missingDocuments).toEqual(['driving_license']);
  });

  it('submits for review and then freezes the documents', async () => {
    const shipper = await newUser('shipper');
    const admin = await newAdmin();
    await uploadAll(shipper, ['citizenship_front', 'citizenship_back']);

    const res = await submit(shipper).expect(200);
    expect(res.body.kyc.status).toBe('pending');
    expect(res.body.user.kycStatus).toBe('pending');

    const blocked = await uploadDoc(shipper, 'citizenship_front');
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/under review/);
    const docId = res.body.kyc.documents[0]._id;
    expect((await as(shipper.token).delete(`/api/users/me/kyc/documents/${docId}`)).status).toBe(400);

    const queue = (await as(admin.token).get('/api/admin/kyc/pending').expect(200)).body.users;
    expect(queue).toHaveLength(1);
    expect(queue[0].documents).toHaveLength(2);
    expect(queue[0].documents.every((d) => d.url.includes('expires_at='))).toBe(true);
  });

  it('lets an admin approve a pending submission', async () => {
    const shipper = await newUser('shipper');
    const admin = await newAdmin();
    await uploadAll(shipper, ['citizenship_front', 'citizenship_back']);
    await submit(shipper).expect(200);

    await review(admin, shipper, { decision: 'approved' }).expect(200);

    expect((await myKyc(shipper)).status).toBe('approved');
    const blocked = await uploadDoc(shipper, 'citizenship_front');
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/approved/);
  });

  it('requires a reason to reject, shows it to the user, and allows a resubmission', async () => {
    const shipper = await newUser('shipper');
    const admin = await newAdmin();
    await uploadAll(shipper, ['citizenship_front', 'citizenship_back']);
    await submit(shipper).expect(200);

    expect((await review(admin, shipper, { decision: 'rejected' })).status).toBe(400);
    await review(admin, shipper, { decision: 'rejected', reason: 'The back of the card is blurry' }).expect(200);

    const rejected = await myKyc(shipper);
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('The back of the card is blurry');
    expect(rejected.canEdit).toBe(true);

    await uploadDoc(shipper, 'citizenship_back').expect(201);
    const resubmitted = (await submit(shipper).expect(200)).body.kyc;
    expect(resubmitted.status).toBe('pending');
    expect(resubmitted.rejectionReason).toBeUndefined();
  });

  it('refuses to review someone who never submitted', async () => {
    const shipper = await newUser('shipper');
    const admin = await newAdmin();

    expect((await review(admin, shipper, { decision: 'approved' })).status).toBe(400);
    const missing = await as(admin.token)
      .patch(`/api/admin/kyc/${new mongoose.Types.ObjectId()}`)
      .send({ decision: 'approved' });
    expect(missing.status).toBe(404);
  });

  it('keeps reviewing admin-only', async () => {
    const shipper = await newUser('shipper');
    const other = await newUser('shipper');

    expect((await as(shipper.token).get('/api/admin/kyc/pending')).status).toBe(403);
    expect((await as(shipper.token).patch(`/api/admin/kyc/${other.id}`).send({ decision: 'approved' })).status).toBe(403);
  });
});
