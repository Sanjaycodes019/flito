import AsyncStorage from '@react-native-async-storage/async-storage';

// Trip routes kept on the phone, so opening a booking again draws its road
// without asking the server. A trip's planned road doesn't change, so a week
// is safe; only the most recent few are kept (a thinned route is a few KB).
const KEY = 'flito.routes.v1';
const MAX_ROUTES = 20;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let memory = null;

const load = async () => {
  if (!memory) {
    try {
      memory = JSON.parse(await AsyncStorage.getItem(KEY)) || {};
    } catch {
      memory = {};
    }
  }
  return memory;
};

export const getCachedRoute = async (bookingId) => {
  const all = await load();
  const hit = all[bookingId];
  return hit && Date.now() - hit.savedAt < MAX_AGE_MS ? hit.route : null;
};

export const cacheRoute = async (bookingId, route) => {
  const all = await load();
  all[bookingId] = { route, savedAt: Date.now() };
  Object.keys(all)
    .sort((a, b) => all[b].savedAt - all[a].savedAt)
    .slice(MAX_ROUTES)
    .forEach((id) => delete all[id]);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable: the route is still remembered until the app closes.
  }
};

// Exposed so tests can start from a clean slate.
export const _clearRouteCache = async () => {
  memory = null;
  await AsyncStorage.removeItem(KEY);
};
