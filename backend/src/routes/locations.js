const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getTree, locate } = require('../services/nepalLocations');
const { wardAt } = require('../services/nepalWards');
const { suggestPlace } = require('../services/nepalPlaces');
const { fail } = require('../utils/respond');

// Nepal's provinces, districts and local levels (with ward counts). Public
// and rarely changing, so browsers and proxies may cache it for a day.
router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ success: true, locations: getTree() });
});

// Detection is answered from data on the server, so this only keeps one user
// from hammering it.
const detectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, code: 'LOCATIONS_TOO_MANY_LOOKUPS', message: 'Too many location lookups. Try again in a few minutes.' },
});

const isCoordinate = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

// "Use current location": the province, district, local level and ward
// containing the point, plus a suggested tole/area name, all from data shipped
// with the server. The ward is null where it isn't mapped, and the app asks
// the person to check it either way.
router.post('/detect', authMiddleware, detectLimiter, (req, res, next) => {
  try {
    const { lat, lng } = req.body || {};
    if (!isCoordinate(lat, 90) || !isCoordinate(lng, 180)) {
      return fail(res, 400, 'LOCATIONS_INVALID_COORDINATES', 'lat must be -90 to 90 and lng must be -180 to 180');
    }

    const place = locate(lat, lng);
    if (!place) return res.json({ success: true, inNepal: false });

    const ward = wardAt(place.localLevelId, lat, lng);
    const suggestion = suggestPlace(lat, lng);
    res.json({
      success: true,
      inNepal: true,
      ...place,
      ward,
      wardSource: ward ? 'OpenStreetMap' : null,
      areaName: suggestion?.name || null,
      areaNameNe: suggestion?.nameNe || null,
      areaSource: suggestion ? 'OpenStreetMap' : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
