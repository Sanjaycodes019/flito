const request = require('supertest');
const { setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone, uniqueEmail, TEST_PASSWORD } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

describe('POST /api/auth/signup', () => {
  it('rejects an invalid email', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' });
    expect(res.status).toBe(400);
  });

  it('rejects a weak password', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: uniqueEmail(), password: 'short1', role: 'shipper', firstName: 'Ram' });
    expect(res.status).toBe(400);
  });

  it('rejects a password with no digit', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: uniqueEmail(), password: 'alllettersnodigit', role: 'shipper', firstName: 'Ram' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown role', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: uniqueEmail(), password: TEST_PASSWORD, role: 'admin', firstName: 'Ram' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing first name', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: uniqueEmail(), password: TEST_PASSWORD, role: 'shipper' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid phone number, even though phone is optional', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: uniqueEmail(), password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram', phone: '98000000' });
    expect(res.status).toBe(400);
  });

  it('creates a user with no phone number and returns a token', async () => {
    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: uniqueEmail(), password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);

    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('shipper');
    expect(res.body.user.phone).toBeUndefined();
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.user.password).toBeUndefined();
    // Dev convenience only, mirrors the old OTP-in-response behavior.
    expect(res.body.verificationCode).toBe('123456');
  });

  it('accepts an optional phone number', async () => {
    const PHONE = uniquePhone();
    const { user } = await signUp({ phone: PHONE, role: 'owner' });
    expect(user.phone).toBe(PHONE);
  });

  it('refuses a duplicate email', async () => {
    const EMAIL = uniqueEmail();
    await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);

    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'owner', firstName: 'Other' });
    expect(res.status).toBe(409);
  });

  it('refuses a duplicate phone number', async () => {
    const PHONE = uniquePhone();
    await signUp({ phone: PHONE, role: 'shipper' });

    const res = await request(app())
      .post('/api/auth/signup')
      .send({ email: uniqueEmail(), password: TEST_PASSWORD, phone: PHONE, role: 'owner', firstName: 'Other' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right email and password', async () => {
    const EMAIL = uniqueEmail();
    await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);

    const res = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: TEST_PASSWORD }).expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(EMAIL);
  });

  it('rejects the wrong password without revealing the account exists', async () => {
    const EMAIL = uniqueEmail();
    await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);

    const wrongPassword = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: 'WrongPass123' });
    const noSuchAccount = await request(app()).post('/api/auth/login').send({ email: uniqueEmail(), password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchAccount.status).toBe(401);
    expect(wrongPassword.body.message).toBe(noSuchAccount.body.message);
  });
});

describe('email verification', () => {
  it('verifies with the right code', async () => {
    const EMAIL = uniqueEmail();
    await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);

    const res = await request(app()).post('/api/auth/verify-email').send({ email: EMAIL, code: '123456' }).expect(200);
    expect(res.body.user.emailVerified).toBe(true);
  });

  it('rejects the wrong code', async () => {
    const EMAIL = uniqueEmail();
    await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);

    const res = await request(app()).post('/api/auth/verify-email').send({ email: EMAIL, code: '000000' });
    expect(res.status).toBe(400);
  });

  it('resend requires auth and issues a fresh code', async () => {
    const noToken = await request(app()).post('/api/auth/resend-verification');
    expect(noToken.status).toBe(401);

    const { token } = await signUp({ role: 'shipper' });
    const res = await as(token).post('/api/auth/resend-verification').expect(200);
    expect(res.body.verificationCode).toBe('123456');
  });
});

describe('password reset', () => {
  it('always returns a generic response, whether or not the email exists', async () => {
    const EMAIL = uniqueEmail();
    await signUp({ role: 'shipper' }); // some account exists, just not this email

    const unknown = await request(app()).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
    expect(unknown.body.resetCode).toBeUndefined();
  });

  it('resets the password with a valid code and logs in with the new one', async () => {
    const EMAIL = uniqueEmail();
    await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);

    const forgot = await request(app()).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);
    expect(forgot.body.resetCode).toBe('123456');

    await request(app())
      .post('/api/auth/reset-password')
      .send({ email: EMAIL, code: '123456', newPassword: 'NewPass123' })
      .expect(200);

    const oldPassword = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: TEST_PASSWORD });
    const newPassword = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: 'NewPass123' });

    expect(oldPassword.status).toBe(401);
    expect(newPassword.status).toBe(200);
  });

  it('rejects an expired or wrong code', async () => {
    const EMAIL = uniqueEmail();
    await request(app())
      .post('/api/auth/signup')
      .send({ email: EMAIL, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
      .expect(201);
    await request(app()).post('/api/auth/forgot-password').send({ email: EMAIL }).expect(200);

    const res = await request(app())
      .post('/api/auth/reset-password')
      .send({ email: EMAIL, code: '000000', newPassword: 'NewPass123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/google', () => {
  // No GOOGLE_CLIENT_ID is set in the test environment (tests/setupEnv.js),
  // matching a deployment that hasn't configured Google sign-in yet: the
  // route should say so clearly rather than fail on token verification.
  it('reports not configured rather than attempting verification', async () => {
    const res = await request(app()).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.status).toBe(503);
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
    const { token, user } = await signUp({ role: 'shipper' });
    const res = await as(token).get('/api/auth/me').expect(200);
    expect(res.body.user.email).toBe(user.email);
  });
});
