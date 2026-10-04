const request = require('supertest');

const createApp = require('../src/app');
const allowedOrigins = require('../src/config/allowedOrigins');

describe('allowed origins', () => {
  const original = process.env.FRONTEND_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = original;
  });

  it('accepts several comma-separated origins and drops trailing slashes', () => {
    process.env.FRONTEND_URL = 'https://sanjay019.com.np/, https://flito.vercel.app';
    expect(allowedOrigins()).toEqual([
      'https://sanjay019.com.np',
      'https://flito.vercel.app',
      'http://localhost:19006',
      'http://localhost:8081',
    ]);
  });

  it('falls back to the local dev origins when unset', () => {
    delete process.env.FRONTEND_URL;
    expect(allowedOrigins()).toEqual(['http://localhost:19006', 'http://localhost:8081']);
  });

  it('lets every listed origin through CORS and blocks others', async () => {
    process.env.FRONTEND_URL = 'https://sanjay019.com.np,https://flito.vercel.app';
    // createApp reads FRONTEND_URL when called, so build it after setting it.
    const app = createApp();

    for (const origin of ['https://sanjay019.com.np', 'https://flito.vercel.app']) {
      const res = await request(app).get('/api/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
