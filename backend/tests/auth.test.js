const request = require('supertest');
const { setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);


describe('POST /api/auth/send-otp', () => {
  it('rejects a non-Nepali phone number', async () => {
    const res = await request(app()).post('/api/auth/send-otp').send({ phone: '9800000001' });
    expect(res.status).toBe(400);
  });

  it('returns the OTP only outside production', async () => {
    const PHONE = uniquePhone();
    const res = await request(app()).post('/api/auth/send-otp').send({ phone: PHONE }).expect(200);
    expect(res.body.otp).toBe('123456');
  });
});

describe('POST /api/auth/signup', () => {
  it('rejects a wrong OTP', async () => {
    const PHONE = uniquePhone();
    await request(app()).post('/api/auth/send-otp').send({ phone: PHONE });

    const res = await request(app())
      .post('/api/auth/signup')
      .send({ phone: PHONE, otp: '000000', role: 'shipper', firstName: 'Ram' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  // Regression: consumeOtp became async, and an un-awaited Promise is always
  // truthy, which silently accepted ANY code. This is the guard for that.
  it('rejects signup when no OTP was ever requested', async () => {
    const PHONE = uniquePhone();
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ phone: PHONE, otp: '123456', role: 'shipper', firstName: 'Ram' });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown role', async () => {
    const PHONE = uniquePhone();
    await request(app()).post('/api/auth/send-otp').send({ phone: PHONE });
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ phone: PHONE, otp: '123456', role: 'admin', firstName: 'Ram' });

    expect(res.status).toBe(400);
  });

  it('creates a user and returns a token', async () => {
    const PHONE = uniquePhone();
    const { token, user } = await signUp({ phone: PHONE, role: 'shipper' });
    expect(token).toBeTruthy();
    expect(user.role).toBe('shipper');
    expect(user.password).toBeUndefined();
  });

  it('refuses a duplicate phone number', async () => {
    const PHONE = uniquePhone();
    await signUp({ phone: PHONE, role: 'shipper' });
    await request(app()).post('/api/auth/send-otp').send({ phone: PHONE });

    const res = await request(app())
      .post('/api/auth/signup')
      .send({ phone: PHONE, otp: '123456', role: 'owner', firstName: 'Other' });

    expect(res.status).toBe(409);
  });

  it('does not let one OTP be reused', async () => {
    const PHONE = uniquePhone();
    await request(app()).post('/api/auth/send-otp').send({ phone: PHONE });
    await request(app())
      .post('/api/auth/signup')
      .send({ phone: PHONE, otp: '123456', role: 'shipper', firstName: 'Ram' })
      .expect(201);

    const res = await request(app()).post('/api/auth/login').send({ phone: PHONE, otp: '123456' });
    expect(res.status).toBe(400);
  });
});

describe('protected routes', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app()).get('/api/loads');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await as('not-a-real-token').get('/api/loads');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid token', async () => {
    const PHONE = uniquePhone();
    const { token } = await signUp({ phone: PHONE, role: 'shipper' });
    const res = await as(token).get('/api/auth/me').expect(200);
    expect(res.body.user.phone).toBe(PHONE);
  });
});
