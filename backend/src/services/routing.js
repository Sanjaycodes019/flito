const axios = require('axios');
const { pointOf, estimateRoadKm } = require('./nepalLocations');

// Real road distances from an OSRM server (OpenStreetMap roads).
//
// By default this uses the public demo server, which is free but asks for at
// most about one request a second, so requests are queued that far apart and
// every answer is cached. Point OSRM_URL at your own OSRM server (or any
// OSRM-compatible one) to lift that limit, or set OSRM_URL=off to skip routing
// and use the straight-line estimate everywhere.
//
// Routing is best-effort: when the server is down or slow, a distance falls
// back to the estimate in nepalLocations.js instead of failing the request.

const PUBLIC_DEMO_URL = 'https://router.project-osrm.org';
const PUBLIC_MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 6000;
const BATCH_SIZE = 80; // the demo server accepts up to 100 coordinates per request
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 20000;

const baseUrl = () => (process.env.OSRM_URL || PUBLIC_DEMO_URL).replace(/\/+$/, '');
const enabled = () => process.env.OSRM_URL !== 'off';
const isPublicDemo = () => baseUrl() === PUBLIC_DEMO_URL;

const cache = new Map();
let queue = Promise.resolve();
let lastRequestAt = 0;

const cacheKey = (a, b) => `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

const remember = (key, km) => {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { km, expires: Date.now() + CACHE_TTL_MS });
};

const recall = (key) => {
  const hit = cache.get(key);
  return hit && hit.expires > Date.now() ? hit.km : undefined;
};

// Runs requests one at a time, spaced out when using the public server.
const throttled = (task) => {
  const run = queue.then(async () => {
    if (isPublicDemo()) {
      const wait = lastRequestAt + PUBLIC_MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
    }
    return task();
  });
  queue = run.catch(() => {});
  return run;
};

const toKm = (meters) => Math.max(1, Math.round(meters / 1000));
const coord = (p) => `${p.lng},${p.lat}`;

// Road distances in km from each origin point to one destination point, in one
// request. Entries the server can't route are null.
const fetchTable = async (origins, destination) => {
  const coordinates = [...origins, destination].map(coord).join(';');
  const sources = origins.map((_, i) => i).join(';');
  const { data } = await throttled(() => axios.get(`${baseUrl()}/table/v1/driving/${coordinates}`, {
    params: { sources, destinations: origins.length, annotations: 'distance' },
    timeout: TIMEOUT_MS,
  }));
  if (data?.code !== 'Ok' || !Array.isArray(data.distances)) throw new Error(`routing answered ${data?.code || 'nothing'}`);
  return data.distances.map((row) => (typeof row?.[0] === 'number' ? toKm(row[0]) : null));
};

// Road distance between two places, as { km, source } where source is
// 'route' for a real road distance and 'estimate' for the straight-line
// fallback. km is null when either place can't be placed at all.
const roadDistance = async (from, to) => {
  const a = pointOf(from);
  const b = pointOf(to);
  if (!a || !b) return { km: null, source: 'estimate' };

  const key = cacheKey(a, b);
  const cached = recall(key);
  if (cached !== undefined) return { km: cached, source: 'route' };

  if (enabled()) {
    try {
      const [km] = await fetchTable([a], b);
      if (km != null) {
        remember(key, km);
        return { km, source: 'route' };
      }
    } catch (error) {
      console.error('[routing] falling back to an estimate:', error.message);
    }
  }
  return { km: estimateRoadKm(from, to), source: 'estimate' };
};

// Road distances from many places to one, as an array of km (or null),
// batching what isn't cached into as few requests as possible.
const roadDistancesTo = async (origins, to) => {
  const destination = pointOf(to);
  const points = origins.map(pointOf);
  const result = origins.map(() => null);
  if (!destination) return result;

  const missing = [];
  points.forEach((point, i) => {
    if (!point) return;
    const cached = recall(cacheKey(point, destination));
    if (cached !== undefined) result[i] = cached;
    else missing.push(i);
  });

  // Bases share municipalities, so several trucks often share one origin.
  const unique = new Map();
  missing.forEach((i) => unique.set(cacheKey(points[i], destination), points[i]));
  const uniqueKeys = [...unique.keys()];

  if (uniqueKeys.length && enabled()) {
    for (let start = 0; start < uniqueKeys.length; start += BATCH_SIZE) {
      const keys = uniqueKeys.slice(start, start + BATCH_SIZE);
      try {
        const kms = await fetchTable(keys.map((k) => unique.get(k)), destination);
        kms.forEach((km, i) => { if (km != null) remember(keys[i], km); });
      } catch (error) {
        console.error('[routing] falling back to estimates:', error.message);
        break;
      }
    }
  }

  missing.forEach((i) => {
    const cached = recall(cacheKey(points[i], destination));
    result[i] = cached !== undefined ? cached : estimateRoadKm(origins[i], to);
  });
  return result;
};

module.exports = { roadDistance, roadDistancesTo };

// Exposed so tests can start from a clean slate.
module.exports._clearCache = () => cache.clear();
