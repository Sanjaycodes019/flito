// Adds Devanagari names to FLITO's Nepal address data, from the same
// local-states-nepal dataset buildNepalLocations.js already uses for ward
// counts and categories (see src/data/nepal/SOURCES.md).
//
// Usage:
//   node scripts/addNepaliLocationNames.js <local-states-nepal/dataset>
//
// Adds to src/data/nepal/locations.json, in place:
//   nameNe on every province, district and local level
//   categoryNe on every local level
//
// Doesn't need the original GeoJSON boundaries download. It re-derives the
// pairing buildNepalLocations.js already made — when its dataset's English
// name differed from the official one, it recorded that dataset name as an
// alias, so the dataset row for any entry is exactly the one whose name is
// that entry's alias (or, with no alias, its own name). Matching English
// names this way, rather than re-running the original fuzzy scorer, is both
// simpler and exact; a similarity-based fallback only covers edge cases the
// alias didn't (there should be none).

const fs = require('fs');
const path = require('path');
const { canon, similarity } = require('./lib/nameMatch');

const datasetDir = process.argv[2];
if (!datasetDir) {
  console.error('Usage: node scripts/addNepaliLocationNames.js <local-states-nepal/dataset>');
  process.exit(1);
}

const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'nepal', 'locations.json');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const locations = read(DATA_PATH);
const dsProvincesNe = read(path.join(datasetDir, 'provinces/np.json'));
const dsDistrictsEn = read(path.join(datasetDir, 'districts/en.json'));
const dsDistrictsNe = read(path.join(datasetDir, 'districts/np.json'));
const dsMunicipalitiesEn = read(path.join(datasetDir, 'municipalities/en.json'));
const dsMunicipalitiesNe = read(path.join(datasetDir, 'municipalities/np.json'));
const dsCategoriesEn = read(path.join(datasetDir, 'categories/en.json'));
const dsCategoriesNe = read(path.join(datasetDir, 'categories/np.json'));

const neNameById = (list) => new Map(list.map((row) => [row.id, row.name]));
const provinceNeById = neNameById(dsProvincesNe);
const districtNeById = neNameById(dsDistrictsNe);
const municipalityNeById = neNameById(dsMunicipalitiesNe);
const categoryNeByEn = new Map(dsCategoriesEn.map((c) => [c.name, dsCategoriesNe.find((n) => n.id === c.id)?.name]));

// The dataset row for an official entry: exact name match against the
// entry's alias (the dataset's own recorded name) or, lacking one, its
// official name — falling back to fuzzy similarity only if that fails.
const findDatasetMatch = (name, aliases, candidates) => {
  const targets = [name, ...(aliases || [])];
  const exact = candidates.find((c) => targets.includes(c.name));
  if (exact) return exact;
  const canonTargets = targets.map(canon);
  let best = null;
  let bestScore = 0;
  candidates.forEach((c) => {
    const score = Math.max(...canonTargets.map((t) => similarity(t, canon(c.name))));
    if (score > bestScore) { bestScore = score; best = c; }
  });
  return bestScore >= 0.55 ? best : null;
};

const unmatched = { provinces: [], districts: [], localLevels: [] };

// Provinces: 7 total, dataset id `n` for our P-code NP0<n> (same convention
// buildNepalLocations.js relies on).
locations.provinces.forEach((p) => {
  const datasetId = Number(p.id.replace('NP0', ''));
  const ne = provinceNeById.get(datasetId);
  if (ne) p.nameNe = ne;
  else unmatched.provinces.push(p.name);
});

// Districts: matched within their province, then remembered by our own
// district id so local levels below can look up their parent's dataset id.
const districtDatasetId = new Map();
locations.districts.forEach((d) => {
  const provinceDatasetId = Number(d.provinceId.replace('NP0', ''));
  const candidates = dsDistrictsEn.filter((row) => row.province_id === provinceDatasetId);
  const match = findDatasetMatch(d.name, d.aliases, candidates);
  if (match) {
    districtDatasetId.set(d.id, match.id);
    d.nameNe = districtNeById.get(match.id);
  }
  if (!d.nameNe) unmatched.districts.push(d.name);
});

// Local levels: matched within their (already-matched) district.
locations.localLevels.forEach((l) => {
  const dsDistrictId = districtDatasetId.get(l.districtId);
  const candidates = dsMunicipalitiesEn.filter((row) => row.district_id === dsDistrictId);
  const match = findDatasetMatch(l.name, l.aliases, candidates);
  if (match) l.nameNe = municipalityNeById.get(match.id);
  if (!l.nameNe) unmatched.localLevels.push(`${l.name} (district ${l.districtId})`);

  const categoryNe = categoryNeByEn.get(l.category);
  if (categoryNe) l.categoryNe = categoryNe;
});

fs.writeFileSync(DATA_PATH, `${JSON.stringify(locations)}\n`);

console.log(`provinces: ${locations.provinces.filter((p) => p.nameNe).length}/${locations.provinces.length}`);
console.log(`districts: ${locations.districts.filter((d) => d.nameNe).length}/${locations.districts.length}`);
console.log(`localLevels: ${locations.localLevels.filter((l) => l.nameNe).length}/${locations.localLevels.length}`);
if (unmatched.provinces.length) console.log('unmatched provinces:', unmatched.provinces.join(', '));
if (unmatched.districts.length) console.log('unmatched districts:', unmatched.districts.join(', '));
if (unmatched.localLevels.length) console.log('unmatched local levels:', unmatched.localLevels.join(', '));
