const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Suggests a tole, village or neighbourhood name for a point from a list of
// about 18,000 named places in OpenStreetMap, built by
// scripts/buildNepalWards.js (see data/nepal/SOURCES.md) and shipped with the
// server. It replaces a per-request lookup on the public Nominatim service:
// nothing leaves the server, there is no rate limit to share with other
// users, and an answer takes microseconds.
//
// Coverage is uneven: towns and larger settlements are well mapped, and many
// small toles are not. So a name is only offered when a mapped place is
// close, and it is only a suggestion the person checks and can change.

const FILE = path.join(__dirname, '..', 'data', 'nepal', 'places.json.gz');

// Close enough to call "this place". Towns are dense, so their toles are
// within a few hundred metres; the village points in the hills are sparser.
const MAX_DISTANCE_M = 1200;
const CELL_DEGREES = 0.01; // about 1.1 km

let index = null;

const cellOf = (lat, lng) => `${Math.floor(lat / CELL_DEGREES)},${Math.floor(lng / CELL_DEGREES)}`;

const load = () => {
  if (index) return index;
  index = new Map();
  try {
    const { scale, places } = JSON.parse(zlib.gunzipSync(fs.readFileSync(FILE)).toString('utf8'));
    places.forEach(([lat, lng, name, nameNe]) => {
      const place = { lat: lat / scale, lng: lng / scale, name, nameNe: nameNe || null };
      const key = cellOf(place.lat, place.lng);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(place);
    });
  } catch (error) {
    logger.error('[nepalPlaces] place names unavailable:', error.message);
  }
  return index;
};

const metresBetween = (lat1, lng1, lat2, lng2) => {
  const dLat = (lat2 - lat1) * 111320;
  const dLng = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

// The nearest named place to a point, as { name, nameNe, distanceM }, or null
// when nothing is mapped nearby.
const suggestPlace = (lat, lng) => {
  const places = load();
  const row = Math.floor(lat / CELL_DEGREES);
  const col = Math.floor(lng / CELL_DEGREES);

  let best = null;
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      (places.get(`${row + dRow},${col + dCol}`) || []).forEach((place) => {
        const distanceM = metresBetween(lat, lng, place.lat, place.lng);
        if (distanceM <= MAX_DISTANCE_M && (!best || distanceM < best.distanceM)) {
          best = { name: place.name, nameNe: place.nameNe, distanceM: Math.round(distanceM) };
        }
      });
    }
  }
  return best;
};

module.exports = { suggestPlace };
