// Encoded polylines (the format OSRM and Google use, precision 5) and
// thinning one down for a map.
//
// A routing server's full line has a point every few metres, most of them on
// straight road where they change nothing on screen: Kathmandu to Pokhara is
// about 7,500 points. Dropping every point that lies within a few metres of
// the line through its neighbours keeps the road where it is to that
// tolerance and makes the line several times smaller to store, send and
// draw.

const decode = (encoded) => {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

const encodeValue = (value) => {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
};

const encode = (points) => {
  let lastLat = 0;
  let lastLng = 0;
  return points.map(([lat, lng]) => {
    const la = Math.round(lat * 1e5);
    const ln = Math.round(lng * 1e5);
    const chunk = encodeValue(la - lastLat) + encodeValue(ln - lastLng);
    lastLat = la;
    lastLng = ln;
    return chunk;
  }).join('');
};

const METERS_PER_DEGREE = 111320;

// Douglas-Peucker: the fewest points that keep every dropped point within
// `toleranceM` metres of the line. Points are projected flat around the
// line's mean latitude, which is exact enough over one country.
const simplify = (points, toleranceM) => {
  if (points.length < 3) return points.slice();
  const meanLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const xy = points.map(([lat, lng]) => [lng * k * METERS_PER_DEGREE, lat * METERS_PER_DEGREE]);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const toleranceSq = toleranceM * toleranceM;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = xy[first];
    const [bx, by] = xy[last];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    let farthest = -1;
    let farthestSq = toleranceSq;
    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = xy[i];
      const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
      const ex = ax + dx * t - px;
      const ey = ay + dy * t - py;
      const distSq = ex * ex + ey * ey;
      if (distSq > farthestSq) {
        farthest = i;
        farthestSq = distSq;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

module.exports = { decode, encode, simplify };
