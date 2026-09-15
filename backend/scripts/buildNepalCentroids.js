// Writes src/data/nepal/centroids.json: the centre point of every local level,
// computed from the committed boundaries (boundaries.json.gz). Distances
// between places (a truck's base to a pickup, a pickup to a dropoff) use these
// points, so the 10 MB of boundaries never has to be loaded for them.
//
//   node scripts/buildNepalCentroids.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data', 'nepal');
const EXPECTED_LOCAL_LEVELS = 753;

// Signed area and first moments of a flat [x0, y0, x1, y1, ...] ring.
const ringMoments = (ring) => {
  let twiceArea = 0;
  let mx = 0;
  let my = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const cross = ring[j] * ring[i + 1] - ring[i] * ring[j + 1];
    twiceArea += cross;
    mx += (ring[j] + ring[i]) * cross;
    my += (ring[j + 1] + ring[i + 1]) * cross;
  }
  const area = twiceArea / 2;
  return { area, x: mx / (6 * area), y: my / (6 * area) };
};

// Area-weighted centre of a multipolygon: outer rings add, holes subtract.
const centroid = (polygons) => {
  let weight = 0;
  let x = 0;
  let y = 0;
  polygons.forEach((rings) => rings.forEach((ring, index) => {
    const moments = ringMoments(ring);
    if (!Number.isFinite(moments.x) || !Number.isFinite(moments.y)) return;
    const w = Math.abs(moments.area) * (index === 0 ? 1 : -1);
    weight += w;
    x += w * moments.x;
    y += w * moments.y;
  }));
  return [Number((y / weight).toFixed(4)), Number((x / weight).toFixed(4))];
};

const main = () => {
  const locations = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'locations.json'), 'utf8'));
  const boundaries = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA_DIR, 'boundaries.json.gz'))).toString('utf8'));

  const localLevels = {};
  boundaries
    .filter((boundary) => boundary.kind === 'localLevel')
    .forEach((boundary) => { localLevels[boundary.id] = centroid(boundary.polygons); });

  const count = Object.keys(localLevels).length;
  const missing = locations.localLevels.filter((l) => !localLevels[l.id]);
  if (count !== EXPECTED_LOCAL_LEVELS || missing.length) {
    console.error(`Expected ${EXPECTED_LOCAL_LEVELS} local levels with a centre, got ${count} (${missing.length} missing)`);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'centroids.json'),
    `${JSON.stringify({ validOn: locations.validOn, localLevels })}\n`,
  );
  console.log(`Wrote centres for ${count} local levels.`);
};

main();
