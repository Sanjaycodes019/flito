const express = require('express');
const router = express.Router();

const bookingsController = require('../controllers/bookingsController');
const deliveryProofController = require('../controllers/deliveryProofController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateRating } = require('../middleware/validators');
const { photos } = require('../middleware/upload');

router.use(authMiddleware);

router.get('/', bookingsController.listMyBookings);
router.get('/:id', bookingsController.getBooking);
router.patch('/:id/assign-driver', requireRole('owner'), bookingsController.assignDriver);
router.patch('/:id/status', bookingsController.updateStatus);
router.patch('/:id/location', requireRole('driver'), bookingsController.updateLocation);
router.post('/:id/rate', validateRating, bookingsController.rateBooking);

// The driver check runs before any file bytes are accepted.
router.post(
  '/:id/delivery-proof',
  requireRole('driver'),
  deliveryProofController.loadProofBooking,
  photos(deliveryProofController.MAX_DELIVERY_PHOTOS),
  deliveryProofController.addDeliveryProof,
);

module.exports = router;
