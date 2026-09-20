// Builds FLITO's Nepal address data from two public datasets. The downloads
// themselves are not committed; this script and its output are. See
// src/data/nepal/SOURCES.md for where to get them and their licenses.
//
// Usage:
//   node scripts/buildNepalLocations.js <npl_admin3.geojson> <local-states-nepal/dataset>
//
// Writes:
//   src/data/nepal/locations.json      provinces, districts, local levels with ward counts
//   src/data/nepal/boundaries.json.gz  simplified local-level polygons for "use current location"
//
// Names and codes come from the Survey Department boundaries (current, with
// P-codes); ward counts and categories come from local-states-nepal, matched
// to them by romanization-tolerant name and land area within each district.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { canon, similarity, areaSimilarity } = require('./lib/nameMatch');

const [adminPath, datasetDir] = process.argv.slice(2);
if (!adminPath || !datasetDir) {
  console.error('Usage: node scripts/buildNepalLocations.js <npl_admin3.geojson> <local-states-nepal/dataset>');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'src', 'data', 'nepal');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// Renamed local levels whose old and new names share nothing to match on.
const PAIR_OVERRIDES = {
  NP0329401: 370, // Aamachhodingmo (Rasuwa), formerly Parbatikunda
};

// Boundary simplification: about 11 m, well inside typical phone GPS error,
// and it shrinks the file roughly tenfold.
const SIMPLIFY_TOLERANCE_DEG = 0.0001;
const COORD_DECIMALS = 5;

// Expected totals for Nepal's federal structure.
const EXPECTED = { provinces: 7, districts: 77, localLevels: 753, wards: 6743 };

// ── Geometry ───────────────────────────────────────────────────────────────

const round = (n) => Number(n.toFixed(COORD_DECIMALS));

const perpendicularDistance = ([x, y], [x1, y1], [x2, y2]) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
};

// Douglas-Peucker, iterative so large rings don't overflow the stack.
const simplifyRing = (ring) => {
  if (ring.length <= 5) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularDistance(ring[i], ring[start], ring[end]);
      if (d > maxDistance) { maxDistance = d; index = i; }
    }
    if (index !== -1 && maxDistance > SIMPLIFY_TOLERANCE_DEG) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  const simplified = ring.filter((_, i) => keep[i]);
  // A ring needs at least four points (three corners plus the closing one).
  return simplified.length >= 4 ? simplified : ring;
};

// Polygon rings as flat [x0, y0, x1, y1, ...] arrays, simplified and rounded.
const packGeometry = (geometry) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  const packed = polygons.map((rings) => rings.map((ring) => {
    const flat = [];
    simplifyRing(ring).forEach(([x, y]) => {
      flat.push(round(x), round(y));
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    });
    return flat;
  }));
  return { bbox: [round(minX), round(minY), round(maxX), round(maxY)], polygons: packed };
};

// ── Build ──────────────────────────────────────────────────────────────────

const features = read(adminPath).features;
const dsProvinces = read(path.join(datasetDir, 'provinces/en.json'));
const dsDistricts = read(path.join(datasetDir, 'districts/en.json'));
const dsMunicipalities = read(path.join(datasetDir, 'municipalities/en.json'));
const dsCategories = read(path.join(datasetDir, 'categories/en.json'));
const categoryName = Object.fromEntries(dsCategories.map((c) => [c.id, c.name]));

// Provinces: P-code NP01..NP07 is dataset id 1..7.
const provinces = dsProvinces
  .map((p) => ({ id: `NP0${p.id}`, name: p.name }))
  .sort((a, b) => a.id.localeCompare(b.id));

// Districts: official name, matched to the dataset inside the province.
const districtMatch = new Map();
features.forEach(({ properties: o }) => {
  if (districtMatch.has(o.adm2_pcode)) return;
  const provinceNumber = Number(o.adm1_pcode.slice(2, 4));
  const candidates = dsDistricts.filter((d) => d.province_id === provinceNumber);
  const best = candidates
    .map((d) => ({ d, score: similarity(canon(o.adm2_name), canon(d.name)) }))
    .sort((a, b) => b.score - a.score)[0];
  districtMatch.set(o.adm2_pcode, { official: o, dataset: best.d });
});

const districts = [...districtMatch.entries()].map(([pcode, { official, dataset }]) => ({
  id: pcode,
  provinceId: official.adm1_pcode,
  name: official.adm2_name,
  aliases: canon(dataset.name) !== canon(official.adm2_name) || dataset.name !== official.adm2_name ? [dataset.name] : [],
})).sort((a, b) => a.name.localeCompare(b.name));

// Local levels: one-to-one per district by name (70%) and land area (30%).
const pairs = new Map(); // official pcode -> dataset municipality
const byDistrict = new Map();
features.forEach(({ properties: o }) => {
  if (!byDistrict.has(o.adm2_pcode)) byDistrict.set(o.adm2_pcode, []);
  byDistrict.get(o.adm2_pcode).push(o);
});

for (const [pcode, officials] of byDistrict) {
  const dataset = districtMatch.get(pcode).dataset;
  const candidates = dsMunicipalities.filter((m) => m.district_id === dataset.id);
  const usedOfficial = new Set();
  const usedDataset = new Set();

  officials.forEach((o) => {
    const overrideId = PAIR_OVERRIDES[o.adm3_pcode];
    if (overrideId) {
      pairs.set(o.adm3_pcode, dsMunicipalities.find((m) => m.id === overrideId));
      usedOfficial.add(o.adm3_pcode);
      usedDataset.add(overrideId);
    }
  });

  const options = [];
  officials.forEach((o) => candidates.forEach((m) => {
    const name = similarity(canon(o.adm3_name), canon(m.name));
    const area = areaSimilarity(o.area_sqkm, m.area_sq_km);
    options.push({ o, m, name, area, score: name * 0.7 + area * 0.3 });
  }));
  options.sort((a, b) => b.score - a.score);
  options.forEach(({ o, m, name, area }) => {
    if (usedOfficial.has(o.adm3_pcode) || usedDataset.has(m.id)) return;
    // A pairing needs a close name or, for a renamed place, a near-identical area.
    if (name < 0.55 && area < 0.9) return;
    usedOfficial.add(o.adm3_pcode);
    usedDataset.add(m.id);
    pairs.set(o.adm3_pcode, m);
  });
}

const localLevels = [];
const protectedAreas = [];
features.forEach(({ properties: o }) => {
  const m = pairs.get(o.adm3_pcode);
  if (m) {
    localLevels.push({
      id: o.adm3_pcode,
      districtId: o.adm2_pcode,
      name: o.adm3_name,
      category: categoryName[m.category_id],
      wards: Number(m.wards),
      aliases: m.name !== o.adm3_name ? [m.name] : [],
    });
  } else {
    // National parks, wildlife and hunting reserves and similar areas that
    // belong to a district but aren't a local level anyone lives "in".
    protectedAreas.push({ id: o.adm3_pcode, districtId: o.adm2_pcode, name: o.adm3_name });
  }
});
localLevels.sort((a, b) => a.name.localeCompare(b.name));

// ── Checks ─────────────────────────────────────────────────────────────────

const totals = {
  provinces: provinces.length,
  districts: districts.length,
  localLevels: localLevels.length,
  wards: localLevels.reduce((sum, l) => sum + l.wards, 0),
};
const problems = Object.entries(EXPECTED)
  .filter(([key, expected]) => totals[key] !== expected)
  .map(([key, expected]) => `${key}: expected ${expected}, got ${totals[key]}`);
const unpairedDataset = dsMunicipalities.filter((m) => ![...pairs.values()].includes(m));
if (unpairedDataset.length) problems.push(`dataset local levels without a boundary: ${unpairedDataset.map((m) => m.name).join(', ')}`);
if (localLevels.some((l) => !(l.wards >= 1))) problems.push('a local level has no ward count');

console.log('totals:', JSON.stringify(totals), '| protected areas:', protectedAreas.length);
if (problems.length) {
  problems.forEach((p) => console.error('PROBLEM:', p));
  process.exit(1);
}

// ── Output ─────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const locations = {
  version: features[0].properties.version,
  validOn: features[0].properties.valid_on,
  provinces,
  districts,
  localLevels,
  protectedAreas,
};
fs.writeFileSync(path.join(OUT_DIR, 'locations.json'), `${JSON.stringify(locations)}\n`);

const boundaries = features.map(({ properties: o, geometry }) => {
  const { bbox, polygons } = packGeometry(geometry);
  return { id: o.adm3_pcode, kind: pairs.has(o.adm3_pcode) ? 'localLevel' : 'protectedArea', bbox, polygons };
});
fs.writeFileSync(path.join(OUT_DIR, 'boundaries.json.gz'), zlib.gzipSync(JSON.stringify(boundaries), { level: 9 }));

const size = (file) => `${(fs.statSync(path.join(OUT_DIR, file)).size / 1024).toFixed(0)} KB`;
console.log('wrote locations.json', size('locations.json'), '| boundaries.json.gz', size('boundaries.json.gz'));
