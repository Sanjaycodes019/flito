const axios = require('axios');

// Suggests a tole, village or area name for a point from OpenStreetMap, via
// Nominatim. Best-effort by nature: coverage outside cities is patchy, so the
// app only offers the result as a suggestion the user checks.
//
// The public Nominatim service allows at most one request per second, needs
// an identifying User-Agent, and expects results to be cached. All three are
// handled here. A busy production app should point NOMINATIM_URL at its own
// Nominatim instance instead (see the usage policy at
// https://operations.osmfoundation.org/policies/nominatim/).

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;

// Most specific first: a neighbourhood or tole beats a whole town.
const AREA_FIELDS = ['neighbourhood', 'quarter', 'suburb', 'hamlet', 'residential', 'village', 'town', 'city_district', 'road'];

const cache = new Map();
let queue = Promise.resolve();
let lastRequestAt = 0;

const userAgent = () => `FLITO/1.0 (${process.env.NOMINATIM_CONTACT || 'contact not configured'})`;

// Runs lookups one at a time, at least MIN_INTERVAL_MS apart.
const throttled = (task) => {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => {});
  return run;
};

// Returns a name such as "Basantapur", or null when OpenStreetMap has nothing
// useful or the lookup fails (a failed suggestion never blocks the user).
exports.suggestAreaName = async (lat, lng) => {
  // About 11 m: close enough that two lookups share a suggestion.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const { data } = await throttled(() => axios.get(`${NOMINATIM_URL}/reverse`, {
      params: { format: 'jsonv2', lat, lon: lng, zoom: 17, addressdetails: 1, 'accept-language': 'en' },
      headers: { 'User-Agent': userAgent() },
      timeout: TIMEOUT_MS,
    }));

    const parts = data?.address || {};
    // Skip fields that only say "Ward No. 5": the ward is chosen separately.
    const field = AREA_FIELDS.find((name) => typeof parts[name] === 'string' && parts[name].trim() && !/\bward\b/i.test(parts[name]));
    const value = field ? parts[field].trim().slice(0, 100) : null;

    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    console.error('[reverseGeocode] lookup failed:', error.message);
    return null;
  }
};
