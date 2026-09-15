const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const locations = require('../data/nepal/locations.json');
const centroids = require('../data/nepal/centroids.json');

// Nepal's administrative structure (7 provinces, 77 districts, 753 local
// levels and their ward counts) and local-level boundaries, built by
// scripts/buildNepalLocations.js, plus each local level's centre point, built
// from the boundaries by scripts/buildNepalCentroids.js. See data/nepal/SOURCES.md.

const provinceById = new Map(locations.provinces.map((p) => [p.id, p]));
const districtById = new Map(locations.districts.map((d) => [d.id, d]));
const localLevelById = new Map(locations.localLevels.map((l) => [l.id, l]));
const protectedAreaById = new Map(locations.protectedAreas.map((a) => [a.id, a]));

const TOLE_MAX_LENGTH = 100;

// A padded box around Nepal. A point outside it can't be in any boundary, so
// the polygons are never loaded for it.
const NEPAL_BOUNDS = { minLng: 80.0, minLat: 26.3, maxLng: 88.3, maxLat: 30.5 };

// What the app needs to build the pickers.
const tree = {
  validOn: locations.validOn,
  provinces: locations.provinces,
  districts: locations.districts,
  localLevels: locations.localLevels,
};

const getTree = () => tree;

// ── Detecting a location ───────────────────────────────────────────────────

let boundaries = null;
// About 10 MB once unpacked, so it is read only when someone first uses
// "Use current location", not at server start.
const loadBoundaries = () => {
  if (!boundaries) {
    const packed = fs.readFileSync(path.join(__dirname, '..', 'data', 'nepal', 'boundaries.json.gz'));
    boundaries = JSON.parse(zlib.gunzipSync(packed).toString('utf8'));
  }
  return boundaries;
};

// Even-odd ray casting on a flat [x0, y0, x1, y1, ...] ring.
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Inside the outer ring and not inside any of its holes.
const inPolygon = (x, y, rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((hole) => inRing(x, y, hole));

// The province, district and local level containing a point, or null outside
// Nepal. A point in a national park or reserve has no local level, so
// `localLevelId` is null and `protectedArea` names the area instead. Wards
// are not detected: no current ward boundaries are openly available.
const locate = (lat, lng) => {
  if (lng < NEPAL_BOUNDS.minLng || lng > NEPAL_BOUNDS.maxLng || lat < NEPAL_BOUNDS.minLat || lat > NEPAL_BOUNDS.maxLat) {
    return null;
  }

  const hit = loadBoundaries().find(({ bbox: [minLng, minLat, maxLng, maxLat], polygons }) => (
    lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
    && polygons.some((rings) => inPolygon(lng, lat, rings))
  ));
  if (!hit) return null;

  if (hit.kind === 'localLevel') {
    const localLevel = localLevelById.get(hit.id);
    const district = districtById.get(localLevel.districtId);
    return { provinceId: district.provinceId, districtId: district.id, localLevelId: localLevel.id, protectedArea: null };
  }
  const area = protectedAreaById.get(hit.id);
  const district = districtById.get(area.districtId);
  return { provinceId: district.provinceId, districtId: district.id, localLevelId: null, protectedArea: area.name };
};

// ── Areas and addresses ────────────────────────────────────────────────────

const isCoordinate = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

// A province, district and local level that sit inside each other, such as
// the municipality a truck is based in. Returns { area } or { error }.
const validateArea = (input) => {
  if (!input || typeof input !== 'object') return { error: 'Choose a province, district and municipality' };
  const { provinceId, districtId, localLevelId } = input;

  const province = provinceById.get(provinceId);
  if (!province) return { error: 'Choose a province' };

  const district = districtById.get(districtId);
  if (!district || district.provinceId !== province.id) return { error: 'Choose a district in the selected province' };

  const localLevel = localLevelById.get(localLevelId);
  if (!localLevel || localLevel.districtId !== district.id) return { error: 'Choose a municipality in the selected district' };

  return { area: { provinceId, districtId, localLevelId } };
};

// Checks an address from a client: every level must exist and sit inside the
// one above it, the ward must exist in that local level, and the tole is
// free text. Returns { address } cleaned, or { error } for the user.
const validateAddress = (input) => {
  if (!input || typeof input !== 'object') return { error: 'Address must include province, district, municipality, ward and tole' };
  const { area, error } = validateArea(input);
  if (error) return { error };

  const { ward, tole, coordinates } = input;
  const localLevel = localLevelById.get(area.localLevelId);

  if (!Number.isInteger(ward) || ward < 1 || ward > localLevel.wards) {
    return { error: `Choose a ward from 1 to ${localLevel.wards}` };
  }

  if (typeof tole !== 'string' || !tole.trim() || tole.trim().length > TOLE_MAX_LENGTH) {
    return { error: `Enter your tole, village or area (up to ${TOLE_MAX_LENGTH} characters)` };
  }

  const address = { ...area, ward, tole: tole.trim() };

  if (coordinates !== undefined && coordinates !== null) {
    if (!isCoordinate(coordinates.lat, 90) || !isCoordinate(coordinates.lng, 180)) {
      return { error: 'Location coordinates must have a valid latitude and longitude' };
    }
    address.coordinates = { lat: coordinates.lat, lng: coordinates.lng };
  }

  return { address };
};

// An area with its names filled in: "Budhanilkantha, Kathmandu", or just
// "Kathmandu" where the municipality shares its district's name.
const describeArea = (area) => {
  const localLevel = localLevelById.get(area?.localLevelId);
  const district = districtById.get(area?.districtId);
  if (!localLevel || !district) return null;
  return {
    localLevel: localLevel.name,
    district: district.name,
    province: provinceById.get(district.provinceId)?.name || null,
    label: localLevel.name === district.name ? localLevel.name : `${localLevel.name}, ${district.name}`,
  };
};

// A stored address with its names filled in for display, or null when it is
// missing or incomplete (including one saved before this structure existed).
const describeAddress = (address) => {
  if (!address?.localLevelId || !address.ward || !address.tole) return null;
  const localLevel = localLevelById.get(address.localLevelId);
  const district = districtById.get(address.districtId);
  const province = provinceById.get(address.provinceId);
  if (!localLevel || !district || !province) return null;

  return {
    provinceId: province.id,
    districtId: district.id,
    localLevelId: localLevel.id,
    ward: address.ward,
    tole: address.tole,
    province: province.name,
    district: district.name,
    localLevel: localLevel.name,
    localLevelCategory: localLevel.category,
    // "Basantapur, Ward 20, Kathmandu Metropolitan City, Kathmandu, Bagmati Province"
    formatted: `${address.tole}, Ward ${address.ward}, ${localLevel.name} ${localLevel.category}, ${district.name}, ${province.name}`,
    // "Basantapur, Kathmandu": short enough for one line in a list.
    label: address.tole.toLowerCase() === localLevel.name.toLowerCase()
      ? localLevel.name
      : `${address.tole}, ${localLevel.name}`,
  };
};

const isAddressComplete = (address) => describeAddress(address) !== null;

// ── Distances ──────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

// Roads in Nepal wind through hills and river valleys, so a trip runs well
// over the straight-line distance: Kathmandu and Pokhara are about 145 km
// apart and about 200 km by road. This is an estimate, not a route.
const ROAD_FACTOR = 1.4;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const straightLineKm = (a, b) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

const centreOf = (localLevelId) => {
  const point = centroids.localLevels[localLevelId];
  return point ? { lat: point[0], lng: point[1] } : null;
};

// A place's point: its pinned coordinates when it has them, otherwise the
// centre of its local level.
const pointOf = (place) => (
  isCoordinate(place?.coordinates?.lat, 90) && isCoordinate(place?.coordinates?.lng, 180)
    ? { lat: place.coordinates.lat, lng: place.coordinates.lng }
    : centreOf(place?.localLevelId)
);

// Estimated road distance between two places in whole km, or null when either
// can't be placed.
const estimateRoadKm = (from, to) => {
  const a = pointOf(from);
  const b = pointOf(to);
  if (!a || !b) return null;
  return Math.max(1, Math.round(straightLineKm(a, b) * ROAD_FACTOR));
};

module.exports = {
  getTree,
  locate,
  validateArea,
  validateAddress,
  describeArea,
  describeAddress,
  isAddressComplete,
  estimateRoadKm,
};
