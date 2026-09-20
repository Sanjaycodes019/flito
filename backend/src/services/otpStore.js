const logger = require('../utils/logger');
// OTP storage, kept behind a tiny async interface so the backing store can
// change without touching auth logic.
//
// Default is an in-process Map: fine for a single instance, but codes are lost
// on restart/redeploy and are not shared between instances. Set REDIS_URL to
// use Redis instead once you run more than one instance.

const OTP_TTL_MS = 5 * 60 * 1000;

const memoryStore = new Map();

const memoryBackend = {
  name: 'memory',
  async set(phone, otp) {
    memoryStore.set(phone, { otp, expiresAt: Date.now() + OTP_TTL_MS });
  },
  async consume(phone, otp) {
    const entry = memoryStore.get(phone);
    if (!entry) return false;
    const valid = entry.otp === otp && entry.expiresAt > Date.now();
    if (valid) memoryStore.delete(phone);
    return valid;
  },
};

const createRedisBackend = () => {
  // Required lazily so the `redis` package is only needed when actually used.
  const { createClient } = require('redis');
  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => logger.error('[otpStore] redis error:', err.message));
  const ready = client.connect();
  const key = (phone) => `otp:${phone}`;

  return {
    name: 'redis',
    async set(phone, otp) {
      await ready;
      await client.set(key(phone), otp, { PX: OTP_TTL_MS });
    },
    async consume(phone, otp) {
      await ready;
      const stored = await client.get(key(phone));
      if (stored !== otp) return false;
      await client.del(key(phone));
      return true;
    },
  };
};

const backend = process.env.REDIS_URL ? createRedisBackend() : memoryBackend;

module.exports = {
  backendName: backend.name,
  set: (phone, otp) => backend.set(phone, otp),
  consume: (phone, otp) => backend.consume(phone, otp),
  OTP_TTL_MS,
};
