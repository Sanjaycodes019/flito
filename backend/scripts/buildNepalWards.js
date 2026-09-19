// Builds src/data/nepal/wards.json.gz (ward boundaries) and places.json.gz
// (named tole, village and neighbourhood points) from OpenStreetMap, so that
// "Use current location" can name the ward and suggest a tole entirely from
// data shipped with the server: no lookup service is called at request time.
//
//   node scripts/buildNepalWards.js [workDir]
//
// Raw Overpass answers are cached in workDir (default ./.osm-cache), so an
// interrupted run resumes where it stopped. See src/data/nepal/SOURCES.md.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const axios = require('axios');
const locations = require('../src/data/nepal/locations.json');
const { locate } = require('../src/services/nepalLocations');

const workDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '.osm-cache'));
const outDir = path.join(__dirname, '..', 'src', 'data', 'nepal');
fs.mkdirSync(workDir, { recursive: true });

const ENDPOINTS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const USER_AGENT = 'FLITO-data-build/1.0 (https://github.com/Sanjaycodes019)';
const SCALE = 1e5; // stored coordinates are whole units of 0.00001 degrees, about 1 m
const PARALLEL = 4;
const TOLERANCE = 0.0001; // simplification tolerance in degrees, about 10 m

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const overpass = async (query, cacheFile) => {
  const file = path.join(workDir, cacheFile);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const { data } = await axios.post(url, `data=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 240000,
        maxContentLength: Infinity,
        responseType: 'json',
      });
      if (data && Array.isArray(data.elements)) {
        fs.writeFileSync(file, JSON.stringify(data));
        return data;
      }
    } catch (error) {
      console.error(`  ${cacheFile}: attempt ${attempt + 1} failed (${error.message})`);
    }
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Could not download ${cacheFile}`);
};

// ── Geometry ───────────────────────────────────────────────────────────────

const key = ([x, y]) => `${x},${y}`;

// Joins a relation's separate ways into closed rings.
const joinRings = (ways) => {
  const pool = ways.filter((way) => way.length > 1).map((way) => way.slice());
  const rings = [];
  let broken = 0;
  while (pool.length) {
    let ring = pool.pop();
    let grown = true;
    while (grown && key(ring[0]) !== key(ring[ring.length - 1])) {
      grown = false;
      const end = key(ring[ring.length - 1]);
      const start = key(ring[0]);
      const index = pool.findIndex((way) => [key(way[0]), key(way[way.length - 1])].some((k) => k === end || k === start));
      if (index !== -1) {
        const [way] = pool.splice(index, 1);
        const wayStart = key(way[0]);
        const wayEnd = key(way[way.length - 1]);
        if (wayStart === end) ring = ring.concat(way.slice(1));
        else if (wayEnd === end) ring = ring.concat(way.slice(0, -1).reverse());
        else if (wayEnd === start) ring = way.slice(0, -1).concat(ring);
        else ring = way.slice(1).reverse().concat(ring);
        grown = true;
      }
    }
    if (key(ring[0]) === key(ring[ring.length - 1]) && ring.length >= 4) rings.push(ring);
    else broken += 1;
  }
  return { rings, broken };
};

const perpendicularDistance = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

// Douglas-Peucker on an open polyline (iterative, so long rings can't overflow the stack).
const simplifyLine = (points, tolerance) => {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = 0;
    let worstAt = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > worst) { worst = d; worstAt = i; }
    }
    if (worst > tolerance && worstAt !== -1) {
      keep[worstAt] = 1;
      stack.push([first, worstAt], [worstAt, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

// A ring keeps at least 4 points (three corners, closed) so it stays a polygon.
const simplifyRing = (ring) => {
  // Splitting at the far corner keeps the closed ring's start from being special.
  let far = 0;
  let best = 0;
  ring.forEach((p, i) => {
    const d = Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]);
    if (d > best) { best = d; far = i; }
  });
  const a = simplifyLine(ring.slice(0, far + 1), TOLERANCE);
  const b = simplifyLine(ring.slice(far), TOLERANCE);
  const out = a.concat(b.slice(1));
  return out.length >= 4 ? out : ring;
};

const ringArea = (ring) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(sum / 2);
};

const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Flat, delta-encoded whole-unit coordinates: [x0, y0, dx1, dy1, ...].
const pack = (ring) => {
  const flat = [];
  let px = 0;
  let py = 0;
  ring.forEach(([x, y], i) => {
    const qx = Math.round(x * SCALE);
    const qy = Math.round(y * SCALE);
    flat.push(i === 0 ? qx : qx - px, i === 0 ? qy : qy - py);
    px = qx;
    py = qy;
  });
  return flat;
};

// ── Wards ──────────────────────────────────────────────────────────────────

const wardNumberOf = (tags) => {
  const fromTag = Number.parseInt(tags.ward, 10);
  if (Number.isInteger(fromTag)) return fromTag;
  const fromName = /(?:-|\bward\b\s*(?:no\.?)?\s*)(\d{1,2})\s*$/i.exec(tags.name || '');
  return fromName ? Number(fromName[1]) : null;
};

const districtBoxes = () => {
  const boundaries = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(outDir, 'boundaries.json.gz'))).toString('utf8'));
  const levelDistrict = new Map(locations.localLevels.map((l) => [l.id, l.districtId]));
  const boxes = new Map();
  boundaries.filter((b) => b.kind === 'localLevel').forEach(({ id, bbox }) => {
    const districtId = levelDistrict.get(id);
    const box = boxes.get(districtId) || [180, 90, -180, -90];
    boxes.set(districtId, [Math.min(box[0], bbox[0]), Math.min(box[1], bbox[1]), Math.max(box[2], bbox[2]), Math.max(box[3], bbox[3])]);
  });
  return boxes;
};

const buildWards = async () => {
  const relations = new Map();
  const boxes = districtBoxes();
  let done = 0;
  const queue = [...boxes.entries()];
  const worker = async () => {
    while (queue.length) {
      const [districtId, [minLng, minLat, maxLng, maxLat]] = queue.shift();
      const bbox = [minLat - 0.01, minLng - 0.01, maxLat + 0.01, maxLng + 0.01].map((n) => n.toFixed(4)).join(',');
      const query = `[out:json][timeout:200];rel["boundary"="administrative"]["admin_level"~"^(9|10)$"](${bbox});out geom;`;
      const data = await overpass(query, `wards-${districtId}.json`);
      data.elements.forEach((element) => relations.set(element.id, element));
      done += 1;
      console.log(`  wards ${done}/${boxes.size} districts, ${relations.size} relations so far`);
    }
  };
  // A few at a time: the mirror is slow per request but tolerates some parallelism.
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const levelById = new Map(locations.localLevels.map((l) => [l.id, l]));
  const out = {};
  const stats = { relations: relations.size, noNumber: 0, broken: 0, noLevel: 0, badNumber: 0, duplicate: 0, kept: 0 };
  const best = new Map();

  for (const relation of relations.values()) {
    const tags = relation.tags || {};
    const ward = wardNumberOf(tags);
    if (!ward) { stats.noNumber += 1; continue; }

    const members = (relation.members || []).filter((m) => m.type === 'way' && Array.isArray(m.geometry));
    const toPoints = (m) => m.geometry.map((g) => [g.lon, g.lat]);
    const outer = joinRings(members.filter((m) => m.role !== 'inner').map(toPoints));
    const inner = joinRings(members.filter((m) => m.role === 'inner').map(toPoints));
    if (!outer.rings.length) { stats.broken += 1; continue; }

    // Which local level a ward belongs to comes from where it lies, not from its name.
    const votes = new Map();
    const main = outer.rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));
    const cx = main.reduce((s, p) => s + p[0], 0) / main.length;
    const cy = main.reduce((s, p) => s + p[1], 0) / main.length;
    const samples = [[cx, cy], ...main.filter((_, i) => i % Math.max(1, Math.floor(main.length / 12)) === 0)
      .map(([x, y]) => [cx + (x - cx) * 0.6, cy + (y - cy) * 0.6])];
    samples.forEach(([x, y]) => {
      const hit = locate(y, x);
      if (hit?.localLevelId) votes.set(hit.localLevelId, (votes.get(hit.localLevelId) || 0) + 1);
    });
    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!winner) { stats.noLevel += 1; continue; }
    const [localLevelId] = winner;
    if (ward < 1 || ward > levelById.get(localLevelId).wards) { stats.badNumber += 1; continue; }

    const polygonRings = outer.rings.map((ring) => ({
      ring,
      holes: inner.rings.filter((hole) => inRing(hole[0][0], hole[0][1], ring)),
    }));
    const area = polygonRings.reduce((sum, p) => sum + ringArea(p.ring), 0);

    const id = `${localLevelId}#${ward}`;
    if (best.has(id)) {
      stats.duplicate += 1;
      if (best.get(id).area >= area) continue;
    }
    best.set(id, { localLevelId, ward, area, polygonRings });
  }

  best.forEach(({ localLevelId, ward, polygonRings }) => {
    out[localLevelId] = out[localLevelId] || {};
    out[localLevelId][ward] = polygonRings.map(({ ring, holes }) => [ring, ...holes].map((r) => pack(simplifyRing(r))));
    stats.kept += 1;
  });

  const totalWards = locations.localLevels.reduce((sum, l) => sum + l.wards, 0);
  const levelsComplete = locations.localLevels.filter((l) => Object.keys(out[l.id] || {}).length === l.wards).length;
  console.log(`Wards: ${stats.kept} of ${totalWards} mapped; ${levelsComplete} of ${locations.localLevels.length} local levels fully covered`);
  console.log('  skipped:', JSON.stringify(stats));

  const file = path.join(outDir, 'wards.json.gz');
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify({ scale: SCALE, localLevels: out }), { level: 9 }));
  console.log(`  wrote ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
};

// ── Places (tole, village and neighbourhood names) ─────────────────────────

const DEVANAGARI = /[ऀ-ॿ]/;

const buildPlaces = async () => {
  const query = '[out:json][timeout:240];area["ISO3166-1"="NP"]->.a;'
    + 'node(area.a)["place"~"^(neighbourhood|quarter|suburb|hamlet|village|locality|isolated_dwelling)$"]["name"];out;';
  const data = await overpass(query, 'places.json');

  const seen = new Set();
  const places = [];
  data.elements.forEach(({ lat, lon, tags }) => {
    const english = tags['name:en'] || (!DEVANAGARI.test(tags.name) ? tags.name : null);
    const nepali = tags['name:ne'] || (DEVANAGARI.test(tags.name) ? tags.name : null);
    const name = (english || nepali || '').trim().slice(0, 100);
    if (!name || /\bward\b/i.test(name)) return; // a ward number isn't a tole
    const dedupe = `${Math.round(lat * 1e4)},${Math.round(lon * 1e4)},${name}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    places.push([Math.round(lat * SCALE), Math.round(lon * SCALE), name, nepali && nepali !== name ? nepali.trim().slice(0, 100) : 0]);
  });

  const file = path.join(outDir, 'places.json.gz');
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify({ scale: SCALE, places }), { level: 9 }));
  console.log(`Places: ${places.length} named points; wrote ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
};

(async () => {
  await buildPlaces();
  await buildWards();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
