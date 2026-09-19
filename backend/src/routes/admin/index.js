// The admin API. One router per resource, all behind the same admin-only gate.
// To add a section: create <name>.js here and mount it below.
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const { requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(authMiddleware, requireRole('admin'));

router.use('/stats', require('./stats'));
router.use('/users', require('./users'));
router.use('/loads', require('./loads'));
router.use('/bookings', require('./bookings'));
router.use('/kyc', require('./kyc'));
router.use('/trucks', require('./trucks'));

module.exports = router;
