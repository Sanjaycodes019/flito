const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { setupTestDb, teardownTestDb, clearDb, app, signUp, as, uniquePhone } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

const User = () => mongoose.model('User');

const phoneSignup = (body) => request(app()).post('/api/auth/signup-phone')
  .send({ role: 'shipper', firstName: 'Ram', lastName: 'Shrestha', phone: uniquePhone(), pin: '5824', ...body });
const pinLogin = (phone, pin) => request(app()).post('/api/auth/pin-login').send({ phone, pin });

const newAdmin = async () => {
  const admin = await User().create({ phone: uniquePhone(), role: 'admin', firstName: 'Sita' });
  return { token: jwt.sign({ userId: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' }) };
};

describe('signing up with a phone number and PIN', () => {
  it('creates the account with no email, ready to log in by phone', async () => {
    const phone = uniquePhone();
    const res = await phoneSignup({ phone, role: 'owner' }).expect(201);
    expect(res.body.user).toMatchObject({ role: 'owner', firstName: 'Ram', phone, hasPin: true });
    expect(res.body.user.email).toBeUndefined();
    expect(res.body.user.pin).toBeUndefined();

    const login = await pinLogin(phone, '5824').expect(200);
    expect(login.body.user.hasPin).toBe(true);

    const me = await as(login.body.token).get('/api/auth/me').expect(200);
    expect(me.body.user).toMatchObject({ hasPin: true, hasPassword: false });
  });

  it('refuses a PIN anyone would guess', async () => {
    for (const pin of ['1111', '1234', '9876']) {
      const res = await phoneSignup({ pin }).expect(400);
      expect(res.body.code).toBe('VALIDATION_PIN_TOO_EASY');
    }
    expect((await phoneSignup({ pin: '12a4' }).expect(400)).body.code).toBe('VALIDATION_PIN_FORMAT');
  });

  it('needs a role, a name and a +977 number', async () => {
    await phoneSignup({ role: 'admin' }).expect(400);
    await phoneSignup({ firstName: '  ' }).expect(400);
    await phoneSignup({ phone: '9812345678' }).expect(400);
  });

  it('refuses a number that already has an account', async () => {
    const phone = uniquePhone();
    await signUp({ role: 'owner', phone });
    expect((await phoneSignup({ phone }).expect(409)).body.code).toBe('AUTH_PHONE_IN_USE');
  });

  it('tells a locked-out user to ask FLITO support, not a truck owner', async () => {
    const phone = uniquePhone();
    await phoneSignup({ phone }).expect(201);
    for (let i = 0; i < 5; i += 1) await pinLogin(phone, '5825').expect(401);

    const res = await pinLogin(phone, '5824').expect(429);
    expect(res.body.extra).toMatchObject({ minutes: 15, askOwner: false });
    expect(res.body.message).toContain('FLITO support');
  });
});

describe('setting a PIN from Settings', () => {
  it('lets an email user with a phone number add a PIN and then log in by phone', async () => {
    const phone = uniquePhone();
    const user = await signUp({ role: 'shipper', phone });

    const res = await as(user.token).patch('/api/users/me/pin').send({ pin: '4827' }).expect(200);
    expect(res.body.user.hasPin).toBe(true);
    await pinLogin(phone, '4827').expect(200);
  });

  it('needs a phone number on the account first', async () => {
    const user = await signUp({ role: 'shipper' });
    const res = await as(user.token).patch('/api/users/me/pin').send({ pin: '4827' }).expect(400);
    expect(res.body.code).toBe('USERS_PIN_NEEDS_PHONE');
  });

  it('needs the current PIN to change it, and counts wrong ones toward the lock', async () => {
    const phone = uniquePhone();
    const { token } = (await phoneSignup({ phone }).expect(201)).body;

    expect((await as(token).patch('/api/users/me/pin').send({ pin: '4827' }).expect(400)).body.code).toBe('USERS_WRONG_CURRENT_PIN');
    for (let i = 0; i < 4; i += 1) {
      await as(token).patch('/api/users/me/pin').send({ currentPin: '0001', pin: '4827' }).expect(400);
    }
    expect((await as(token).patch('/api/users/me/pin').send({ currentPin: '5824', pin: '4827' }).expect(429)).body.code).toBe('AUTH_PIN_LOCKED');
  });

  it('changes the PIN with the current one', async () => {
    const phone = uniquePhone();
    const { token } = (await phoneSignup({ phone }).expect(201)).body;

    await as(token).patch('/api/users/me/pin').send({ currentPin: '5824', pin: '4827' }).expect(200);
    await pinLogin(phone, '5824').expect(401);
    await pinLogin(phone, '4827').expect(200);
  });
});

describe('FLITO support resetting a forgotten PIN', () => {
  it('makes a new PIN that works at once and lifts a lock', async () => {
    const phone = uniquePhone();
    const { user } = (await phoneSignup({ phone }).expect(201)).body;
    for (let i = 0; i < 5; i += 1) await pinLogin(phone, '5825').expect(401);

    const admin = await newAdmin();
    const { pin } = (await as(admin.token).post(`/api/admin/users/${user._id}/reset-pin`).expect(200)).body;

    expect(pin).toMatch(/^\d{4}$/);
    await pinLogin(phone, pin).expect(200);
  });

  it('is admin only', async () => {
    const { user, token } = (await phoneSignup({}).expect(201)).body;
    await as(token).post(`/api/admin/users/${user._id}/reset-pin`).expect(403);
  });

  it('needs the user to have a phone number', async () => {
    const user = await signUp({ role: 'shipper' });
    const admin = await newAdmin();
    const res = await as(admin.token).post(`/api/admin/users/${user.id}/reset-pin`).expect(400);
    expect(res.body.code).toBe('ADMIN_PIN_NEEDS_PHONE');
  });
});
