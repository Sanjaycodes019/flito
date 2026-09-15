const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getTree, locate } = require('../services/nepalLocations');
const { suggestAreaName } = require('../services/reverseGeocode');

// Nepal's provinces, districts and local levels (with ward counts). Public
// and rarely changing, so browsers and proxies may cache it for a day.
router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({ success: true, locations: getTree() });
});

// Each detection may call OpenStreetMap, whose public service allows about
// one request a second for the whole app, so one user can't use it all up.
const detectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, message: 'Too many location lookups. Try again in a few minutes.' },
});

const isCoordinate = (value, limit) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

// "Use current location": the province, district and local level containing
// the point, plus a suggested tole/area name. The ward is left to the user.
router.post('/detect', authMiddleware, detectLimiter, async (req, res, next) => {
  try {
    const { lat, lng } = req.body || {};
    if (!isCoordinate(lat, 90) || !isCoordinate(lng, 180)) {
      return res.status(400).json({ success: false, message: 'lat must be -90 to 90 and lng must be -180 to 180' });
    }

    const place = locate(lat, lng);
    if (!place) return res.json({ success: true, inNepal: false });

    const areaName = await suggestAreaName(lat, lng);
    res.json({
      success: true,
      inNepal: true,
      ...place,
      areaName,
      areaSource: areaName ? 'OpenStreetMap' : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
