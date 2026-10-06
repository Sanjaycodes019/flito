// Geometry behind the live tracking map: reading the road line the server
// sends, finding how far along it the truck is, and what is left of the trip.
// Kept apart from the map page so it runs (and is tested) in the app itself.

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg) => (deg * Math.PI) / 180;

// An encoded polyline (the format OSRM and Google use, precision 5) as a list
// of [lat, lng] pairs.
export const decodePolyline = (encoded, precision = 5) => {
  if (typeof encoded !== 'string' || !encoded) return [];
  const factor = 10 ** precision;
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
    points.push([lat / factor, lng / factor]);
  }
  return points;
};

// Great-circle distance in metres between two [lat, lng] pairs.
export const metersBetween = (a, b) => {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

// The compass direction (degrees clockwise from north) from a to b.
export const bearingBetween = (a, b) => {
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

// Metres from the start of `line` to each of its points.
export const measureLine = (line) => {
  const along = [0];
  for (let i = 1; i < line.length; i += 1) along.push(along[i - 1] + metersBetween(line[i - 1], line[i]));
  return along;
};

// The nearest point to `p` on the segment a-b, treating that short stretch of
// the earth as flat (good to well under a metre over a road segment).
const nearestOnSegment = (a, b, p) => {
  const k = Math.cos(toRad(p[0]));
  const ax = a[1] * k; const ay = a[0];
  const bx = b[1] * k; const by = b[0];
  const px = p[1] * k; const py = p[0];
  const dx = bx - ax; const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { t, point, meters: metersBetween(point, p) };
};

// Hill roads in Nepal switch back on themselves, so the nearest stretch of
// road can be a bend the truck already passed. Any stretch this close to the
// nearest one counts as a match, and of those the truck is placed on the
// first that isn't behind where it was last seen (allowing GPS jitter).
const MATCH_TOLERANCE_M = 40;
const BACKWARD_JITTER_M = 50;

// Where `point` ([lat, lng]) is on `line`: the segment it falls on (`index`,
// between line[index] and line[index + 1]), the matching spot on the road,
// how far it is from the road, and how far along it. `fromMeters` is how far
// along the truck was matched last time.
export const locateOnLine = (line, along, point, fromMeters = 0) => {
  if (!Array.isArray(line) || line.length < 2 || !point) return null;

  const matches = [];
  let best = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const hit = nearestOnSegment(line[i], line[i + 1], point);
    const match = { index: i, ...hit, metersAlong: along[i] + (along[i + 1] - along[i]) * hit.t };
    matches.push(match);
    if (!best || hit.meters < best.meters) best = match;
  }

  // The first unbroken stretch of nearby road ahead of the last match, and
  // the closest spot on it.
  let chosen = null;
  for (const m of matches) {
    if (m.meters <= best.meters + MATCH_TOLERANCE_M && m.metersAlong >= fromMeters - BACKWARD_JITTER_M) {
      if (!chosen || m.meters < chosen.meters) chosen = m;
    } else if (chosen) {
      break;
    }
  }
  chosen = chosen || best;

  const total = along[along.length - 1];
  return {
    index: chosen.index,
    point: chosen.point,
    offRouteMeters: chosen.meters,
    metersAlong: chosen.metersAlong,
    metersLeft: Math.max(0, total - chosen.metersAlong),
    fraction: total ? chosen.metersAlong / total : 1,
  };
};

// "850 m", "12.4 km", "132 km".
export const formatDistance = (meters, t) => {
  if (meters == null || !Number.isFinite(meters)) return '';
  if (meters < 1000) return t('loads:trackingMap.units.m', { value: Math.max(10, Math.round(meters / 10) * 10) });
  const km = meters / 1000;
  return t('loads:trackingMap.units.km', { value: km < 20 ? km.toFixed(1) : Math.round(km) });
};

// "45 min", "3 h 20 min", "2 d 4 h".
export const formatDuration = (minutes, t) => {
  if (minutes == null || !Number.isFinite(minutes)) return '';
  const total = Math.max(1, Math.round(minutes));
  if (total < 60) return t('loads:trackingMap.units.min', { value: total });
  const hours = Math.floor(total / 60);
  if (hours < 24) {
    const rest = total % 60;
    return rest ? t('loads:trackingMap.units.hMin', { h: hours, min: rest }) : t('loads:trackingMap.units.h', { value: hours });
  }
  return t('loads:trackingMap.units.dH', { d: Math.floor(hours / 24), h: hours % 24 });
};

// How fresh a GPS fix is: 'live' within a minute, 'recent' within five, then
// 'stale'.
export const freshnessOf = (updatedAt, now = Date.now()) => {
  const at = updatedAt ? new Date(updatedAt).getTime() : NaN;
  if (!Number.isFinite(at)) return { state: 'unknown', seconds: null };
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  return { state: seconds < 60 ? 'live' : seconds < 300 ? 'recent' : 'stale', seconds };
};

// "8 s", "4 min", "2 h".
export const formatAge = (seconds, t) => {
  if (seconds == null) return '';
  if (seconds < 60) return t('loads:trackingMap.units.s', { value: seconds });
  if (seconds < 3600) return t('loads:trackingMap.units.min', { value: Math.round(seconds / 60) });
  return t('loads:trackingMap.units.h', { value: Math.round(seconds / 3600) });
};
