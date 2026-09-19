const request = require('supertest');
const mongoose = require('mongoose');
const email = require('../src/services/email');
const { MAX_CODE_ATTEMPTS } = require('../src/services/verification');
const { setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone, uniqueEmail, TEST_PASSWORD } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);

// Codes are random and only ever emailed, so the suite reads each one from the
// email that would have gone out, exactly as a user would.
let verificationEmails;
let resetEmails;

beforeEach(async () => {
  await clearDb();
  verificationEmails = jest.spyOn(email, 'sendVerificationEmail').mockResolvedValue({ delivered: true });
  resetEmails = jest.spyOn(email, 'sendPasswordResetEmail').mockResolvedValue({ delivered: true });
});

afterEach(() => jest.restoreAllMocks());

const User = () => mongoose.model('User');

// The latest code emailed to an address.
const codeSentTo = (spy, address) => spy.mock.calls.filter(([to]) => to === address).pop()?.[2];

const signUpWithEmail = (address) => request(app())
  .post('/api/auth/signup')
  .send({ email: address, password: TEST_PASSWORD, role: 'shipper', firstName: 'Ram' })
  .expect(201);

// Moves the last send back past the resend wait.
const pastCooldown = (address, field) => User().updateOne({ email: address }, { [field]: new Date(Date.now() - 60 * 1000) });

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

  it('creates a user, and emails a random code that the API never returns', async () => {
    const EMAIL = uniqueEmail();
    const res = await signUpWithEmail(EMAIL);

    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('shipper');
    expect(res.body.user.phone).toBeUndefined();
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.verificationEmailSent).toBe(true);

    const code = codeSentTo(verificationEmails, EMAIL);
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(res.body)).not.toContain(code);

    // Only a hash is stored.
    const stored = await User().findOne({ email: EMAIL }).select('+emailVerificationCode');
    expect(stored.emailVerificationCode).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.emailVerificationCode).not.toContain(code);
  });

  it('still creates the account when the email cannot be sent, and says so', async () => {
    verificationEmails.mockRejectedValueOnce(Object.assign(new Error('Brevo is down'), { status: 502 }));

    const res = await signUpWithEmail(uniqueEmail());

    expect(res.body.token).toBeTruthy();
    expect(res.body.verificationEmailSent).toBe(false);
  });

  it('accepts an optional phone number', async () => {
    const PHONE = uniquePhone();
    const { user } = await signUp({ phone: PHONE, role: 'owner' });
    expect(user.phone).toBe(PHONE);
  });

  it('refuses a duplicate email', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);

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
    await signUpWithEmail(EMAIL);

    const res = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: TEST_PASSWORD }).expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(EMAIL);
  });

  it('rejects the wrong password without revealing the account exists', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);

    const wrongPassword = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: 'WrongPass123' });
    const noSuchAccount = await request(app()).post('/api/auth/login').send({ email: uniqueEmail(), password: TEST_PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchAccount.status).toBe(401);
    expect(wrongPassword.body.message).toBe(noSuchAccount.body.message);
  });
});

describe('email verification', () => {
  const verify = (address, code) => request(app()).post('/api/auth/verify-email').send({ email: address, code });

  it('verifies with the code from the email, once', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);
    const code = codeSentTo(verificationEmails, EMAIL);

    const res = await verify(EMAIL, code).expect(200);
    expect(res.body.user.emailVerified).toBe(true);

    // Used up.
    expect((await verify(EMAIL, code)).status).toBe(400);
  });

  it('rejects the wrong code, and a code for an unknown email the same way', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);
    const code = codeSentTo(verificationEmails, EMAIL);
    const wrong = code === '000000' ? '111111' : '000000';

    const wrongCode = await verify(EMAIL, wrong);
    const unknownEmail = await verify(uniqueEmail(), code);

    expect(wrongCode.status).toBe(400);
    expect(unknownEmail.status).toBe(400);
    expect(wrongCode.body.message).toBe(unknownEmail.body.message);
  });

  it(`locks a code after ${MAX_CODE_ATTEMPTS} wrong tries, even against the right code`, async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);
    const code = codeSentTo(verificationEmails, EMAIL);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
      expect((await verify(EMAIL, wrong)).status).toBe(400);
    }
    const locked = await verify(EMAIL, code);

    expect(locked.status).toBe(429);
    expect(locked.body.message).toMatch(/new code/);
  });

  it('refuses a code that has expired', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);
    await User().updateOne({ email: EMAIL }, { emailVerificationExpires: new Date(Date.now() - 1000) });

    expect((await verify(EMAIL, codeSentTo(verificationEmails, EMAIL))).status).toBe(400);
  });

  it('resend needs a token, waits out the cooldown, then sends a fresh code that replaces the old one', async () => {
    expect((await request(app()).post('/api/auth/resend-verification')).status).toBe(401);

    const EMAIL = uniqueEmail();
    const { token } = (await signUpWithEmail(EMAIL)).body;
    const first = codeSentTo(verificationEmails, EMAIL);

    // The signup email was just sent.
    const tooSoon = await as(token).post('/api/auth/resend-verification');
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.retryAfterSeconds).toBeGreaterThan(0);

    await pastCooldown(EMAIL, 'emailVerificationSentAt');
    const res = await as(token).post('/api/auth/resend-verification').expect(200);
    expect(res.body.verificationCode).toBeUndefined();

    const second = codeSentTo(verificationEmails, EMAIL);
    expect(verificationEmails).toHaveBeenCalledTimes(2);
    if (second !== first) expect((await verify(EMAIL, first)).status).toBe(400);
    await verify(EMAIL, second).expect(200);
  });

  it("says when the email couldn't be sent, and lets the user try again straight away", async () => {
    const EMAIL = uniqueEmail();
    const { token } = (await signUpWithEmail(EMAIL)).body;
    await pastCooldown(EMAIL, 'emailVerificationSentAt');

    verificationEmails.mockRejectedValueOnce(Object.assign(new Error('Brevo is down'), { status: 502 }));
    const failed = await as(token).post('/api/auth/resend-verification');
    expect(failed.status).toBe(502);
    expect(failed.body.message).toMatch(/could not send/i);

    await as(token).post('/api/auth/resend-verification').expect(200);
  });
});

describe('password reset', () => {
  const forgot = (address) => request(app()).post('/api/auth/forgot-password').send({ email: address }).expect(200);
  const reset = (address, code, newPassword = 'NewPass123') => request(app())
    .post('/api/auth/reset-password')
    .send({ email: address, code, newPassword });

  it('always returns the same response, whether or not the email exists', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);

    const unknown = await forgot(uniqueEmail());
    const known = await forgot(EMAIL);

    expect(unknown.body).toEqual(known.body);
    expect(known.body.resetCode).toBeUndefined();
    expect(resetEmails).toHaveBeenCalledTimes(1);
  });

  it('resets the password with the emailed code, once, and confirms the email too', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);
    await forgot(EMAIL);
    const code = codeSentTo(resetEmails, EMAIL);
    expect(code).toMatch(/^\d{6}$/);

    const res = await reset(EMAIL, code).expect(200);
    expect(res.body.user.emailVerified).toBe(true);
    expect((await reset(EMAIL, code, 'Another123')).status).toBe(400);

    const oldPassword = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: TEST_PASSWORD });
    const newPassword = await request(app()).post('/api/auth/login').send({ email: EMAIL, password: 'NewPass123' });
    expect(oldPassword.status).toBe(401);
    expect(newPassword.status).toBe(200);
  });

  it('rejects a wrong code, and a verification code used as a reset code', async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);
    await forgot(EMAIL);
    const resetCode = codeSentTo(resetEmails, EMAIL);
    const verificationCode = codeSentTo(verificationEmails, EMAIL);

    expect((await reset(EMAIL, resetCode === '000000' ? '111111' : '000000')).status).toBe(400);
    if (verificationCode !== resetCode) expect((await reset(EMAIL, verificationCode)).status).toBe(400);
  });

  it("doesn't send another reset email inside the cooldown, without saying so", async () => {
    const EMAIL = uniqueEmail();
    await signUpWithEmail(EMAIL);

    const first = await forgot(EMAIL);
    const again = await forgot(EMAIL);

    expect(again.body).toEqual(first.body);
    expect(resetEmails).toHaveBeenCalledTimes(1);
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

  // With a client id set, a token that fails verification (here, not even a
  // JWT, so it fails locally without a network call) is a 401, not a 500.
  it('rejects an unverifiable token with a 401 once configured', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    try {
      const res = await request(app()).post('/api/auth/google').send({ idToken: 'not-a-real-token' });
      expect(res.status).toBe(401);
    } finally {
      delete process.env.GOOGLE_CLIENT_ID;
    }
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
