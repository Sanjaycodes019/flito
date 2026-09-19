const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Which ward a point is in, from ward boundaries built out of OpenStreetMap by
// scripts/buildNepalWards.js (see data/nepal/SOURCES.md). Wards are looked up
// only inside the local level a point already sits in, so a lookup tests a
// handful of polygons, not all 6,743.
//
// OpenStreetMap's ward boundaries are volunteer-mapped and simplified to about
// 10 m, so a point near a ward border can land in the neighbouring ward, and
// a few local levels have wards that aren't mapped yet. A missing answer is
// null and the person picks their ward; the app always asks them to check.

const FILE = path.join(__dirname, '..', 'data', 'nepal', 'wards.json.gz');

let data = null;
const decoded = new Map();

// Read on first use: it is several MB unpacked, and not everyone needs it.
const load = () => {
  if (data === null) {
    try {
      data = JSON.parse(zlib.gunzipSync(fs.readFileSync(FILE)).toString('utf8'));
    } catch (error) {
      console.error('[nepalWards] ward boundaries unavailable:', error.message);
      data = { scale: 1e5, localLevels: {} };
    }
  }
  return data;
};

// A flat, delta-encoded ring back to [x0, y0, x1, y1, ...] degrees.
const unpack = (flat, scale) => {
  const ring = new Float64Array(flat.length);
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    ring[i] = x / scale;
    ring[i + 1] = y / scale;
  }
  return ring;
};

const boundsOf = (ring) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    minX = Math.min(minX, ring[i]);
    maxX = Math.max(maxX, ring[i]);
    minY = Math.min(minY, ring[i + 1]);
    maxY = Math.max(maxY, ring[i + 1]);
  }
  return [minX, minY, maxX, maxY];
};

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

// The wards of one local level, unpacked once and kept.
const wardsOf = (localLevelId) => {
  if (decoded.has(localLevelId)) return decoded.get(localLevelId);
  const { scale, localLevels } = load();
  const wards = Object.entries(localLevels[localLevelId] || {}).map(([ward, polygons]) => ({
    ward: Number(ward),
    polygons: polygons.map(([outer, ...holes]) => {
      const ring = unpack(outer, scale);
      return { bounds: boundsOf(ring), ring, holes: holes.map((hole) => unpack(hole, scale)) };
    }),
  }));
  decoded.set(localLevelId, wards);
  return wards;
};

// Simplifying each ward's outline to about 10 m can leave slivers between two
// neighbours. A point that falls in one is given to the ward its edge is
// within this many metres of, and to none when it is further from all of them.
const SLIVER_M = 25;

const metresToEdge = (lat, lng, ring) => {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = (ring[j] - lng) * kx;
    const ay = (ring[j + 1] - lat) * 111320;
    const bx = (ring[i] - lng) * kx;
    const by = (ring[i + 1] - lat) * 111320;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
};

// The ward number containing a point in the given local level, or null when
// the point is in no mapped ward.
const wardAt = (localLevelId, lat, lng) => {
  if (!localLevelId) return null;
  const wards = wardsOf(localLevelId);
  const inside = wards.find(({ polygons }) => polygons.some(({ bounds, ring, holes }) => (
    lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3]
    && inRing(lng, lat, ring) && !holes.some((hole) => inRing(lng, lat, hole))
  )));
  if (inside) return inside.ward;

  const margin = SLIVER_M / 111320; // degrees, near enough for a bounding-box test
  let nearest = null;
  wards.forEach(({ ward, polygons }) => polygons.forEach(({ bounds, ring }) => {
    if (lng < bounds[0] - margin || lng > bounds[2] + margin || lat < bounds[1] - margin || lat > bounds[3] + margin) return;
    const distance = metresToEdge(lat, lng, ring);
    if (distance <= SLIVER_M && (!nearest || distance < nearest.distance)) nearest = { ward, distance };
  }));
  return nearest ? nearest.ward : null;
};

// How many of a local level's wards are mapped (for reporting and tests).
const mappedWardCount = (localLevelId) => wardsOf(localLevelId).length;

module.exports = { wardAt, mappedWardCount };
