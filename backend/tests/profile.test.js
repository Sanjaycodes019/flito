jest.mock('../src/services/storage', () => ({
  isConfigured: jest.fn(),
  uploadImages: jest.fn(),
  uploadPrivateDocument: jest.fn(),
  privateDocumentUrl: jest.fn(),
  deleteAssets: jest.fn(),
}));

const storage = require('../src/services/storage');
const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

beforeEach(async () => {
  await clearDb();
  jest.clearAllMocks();
  storage.isConfigured.mockReturnValue(true);
  let counter = 0;
  storage.uploadPrivateDocument.mockImplementation(async (file, { folder }) => {
    counter += 1;
    return { publicId: `${folder}/doc${counter}`, format: 'png', bytes: file.buffer.length };
  });
  storage.privateDocumentUrl.mockReturnValue('https://api.cloudinary.com/v1_1/demo/image/download?expires_at=9999999999');
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const newUser = (role) => signUp({ phone: uniquePhone(), role, firstName: 'Ram', lastName: 'Shrestha' });
const patchMe = (actor, body) => as(actor.token).patch('/api/users/me').send(body);
const me = async (actor) => (await as(actor.token).get('/api/auth/me').expect(200)).body.user;

describe('profile editing', () => {
  it('updates the editable fields', async () => {
    const shipper = await newUser('shipper');

    const res = await patchMe(shipper, {
      firstName: 'Ramesh',
      lastName: 'Shrestha',
      email: '  Ram@Example.com ',
      address: { street: 'Balaju', city: 'Kathmandu' },
    }).expect(200);

    expect(res.body.user).toEqual(expect.objectContaining({
      firstName: 'Ramesh',
      email: 'ram@example.com',
      address: { street: 'Balaju', city: 'Kathmandu' },
    }));
    expect((await me(shipper)).email).toBe('ram@example.com');
  });

  it('ignores fields a user must not change about themselves', async () => {
    const shipper = await newUser('shipper');

    await patchMe(shipper, {
      phone: uniquePhone(),
      role: 'admin',
      kycStatus: 'approved',
      rating: 5,
      firstName: 'Ramesh',
    }).expect(200);

    const user = await me(shipper);
    expect(user.phone).toBe(shipper.user.phone);
    expect(user.role).toBe('shipper');
    expect(user.kycStatus).toBe('not_submitted');
    expect(user.rating).toBe(0);
    expect(user.firstName).toBe('Ramesh');
  });

  it('validates the email address and first name', async () => {
    const shipper = await newUser('shipper');
    expect((await patchMe(shipper, { email: 'not-an-email' })).status).toBe(400);
    expect((await patchMe(shipper, { firstName: '   ' })).status).toBe(400);
  });

  it('refuses an email used by another account, and frees it when cleared', async () => {
    const alice = await newUser('shipper');
    const bob = await newUser('owner');

    await patchMe(alice, { email: 'shared@example.com' }).expect(200);
    expect((await patchMe(bob, { email: 'shared@example.com' })).status).toBe(409);

    await patchMe(alice, { email: '' }).expect(200);
    await patchMe(bob, { email: 'shared@example.com' }).expect(200);
  });

  it('allows a company name only for truck owners', async () => {
    const shipper = await newUser('shipper');
    const owner = await newUser('owner');

    expect((await patchMe(shipper, { companyName: 'Ram Traders' })).status).toBe(400);
    const res = await patchMe(owner, { companyName: 'Thapa Transport' }).expect(200);
    expect(res.body.user.companyName).toBe('Thapa Transport');
  });

  it('locks the name once identity documents are submitted, but not other fields', async () => {
    const shipper = await newUser('shipper');
    for (const type of ['citizenship_front', 'citizenship_back']) {
      await as(shipper.token).post('/api/users/me/kyc/documents')
        .field('type', type)
        .attach('document', PNG, { filename: 'doc.png', contentType: 'image/png' })
        .expect(201);
    }
    await as(shipper.token).post('/api/users/me/kyc/submit').expect(200);

    const renamed = await patchMe(shipper, { firstName: 'Someone Else' });
    expect(renamed.status).toBe(400);
    expect(renamed.body.message).toMatch(/KYC/);

    // Resending the current name, or changing other fields, is fine.
    await patchMe(shipper, { firstName: 'Ram', email: 'ram@example.com' }).expect(200);
  });
});
