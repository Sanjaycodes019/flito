const mongoose = require('mongoose');
const request = require('supertest');

const Notification = require('../src/models/Notification');
const { setupTestDb, teardownTestDb, clearDb, signUp, as, uniquePhone, app } = require('./helpers');

beforeAll(setupTestDb);
afterAll(teardownTestDb);
beforeEach(clearDb);

describe('platform hardening', () => {
  it('reports health with the database state', async () => {
    const res = await request(app()).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app()).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('strips Mongo operators from login bodies', async () => {
    await signUp({ phone: uniquePhone(), role: 'shipper' });
    const res = await request(app())
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.token).toBeUndefined();
  });
});

describe('notification feed', () => {
  const seed = (userId, n) => Notification.insertMany(
    Array.from({ length: n }, (_, i) => ({ userId, title: `Title ${i}`, body: 'Body' })),
  );

  it('lists only the caller\'s notifications with an unread count', async () => {
    const a = await signUp({ phone: uniquePhone(), role: 'shipper' });
    const b = await signUp({ phone: uniquePhone(), role: 'owner' });
    await seed(a.id, 3);
    await seed(b.id, 2);

    const res = await as(a.token).get('/api/users/me/notifications').expect(200);
    expect(res.body.notifications).toHaveLength(3);
    expect(res.body.unreadCount).toBe(3);
  });

  it('marks chosen ids read, then everything', async () => {
    const a = await signUp({ phone: uniquePhone(), role: 'shipper' });
    await seed(a.id, 3);
    const [first] = (await as(a.token).get('/api/users/me/notifications')).body.notifications;

    const one = await as(a.token).post('/api/users/me/notifications/read').send({ ids: [first.id] }).expect(200);
    expect(one.body.unreadCount).toBe(2);

    const all = await as(a.token).post('/api/users/me/notifications/read').send({}).expect(200);
    expect(all.body.unreadCount).toBe(0);
  });

  it('cannot mark another user\'s notifications read', async () => {
    const a = await signUp({ phone: uniquePhone(), role: 'shipper' });
    const b = await signUp({ phone: uniquePhone(), role: 'owner' });
    await seed(b.id, 1);
    const [theirs] = await Notification.find({ userId: b.id });

    await as(a.token).post('/api/users/me/notifications/read').send({ ids: [theirs.id] }).expect(200);
    expect(await Notification.countDocuments({ userId: new mongoose.Types.ObjectId(b.id), readAt: { $exists: false } })).toBe(1);
  });

  it('requires authentication', async () => {
    await request(app()).get('/api/users/me/notifications').expect(401);
  });
});
