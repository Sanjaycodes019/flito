const express = require('express');
const router = express.Router();

const bookingsController = require('../controllers/bookingsController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', bookingsController.listMyBookings);
router.get('/:id', bookingsController.getBooking);
router.patch('/:id/assign-driver', requireRole('owner'), bookingsController.assignDriver);
router.patch('/:id/status', bookingsController.updateStatus);
router.patch('/:id/location', requireRole('driver'), bookingsController.updateLocation);
router.post('/:id/rate', bookingsController.rateBooking);

module.exports = router;
