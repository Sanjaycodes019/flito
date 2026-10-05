const express = require('express');
const router = express.Router();

const bookingsController = require('../controllers/bookingsController');
const deliveryProofController = require('../controllers/deliveryProofController');
const paymentsController = require('../controllers/paymentsController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const {
  validateRating, validateCoordinates, validatePaymentRecord, validatePaymentDispute,
} = require('../middleware/validators');
const { photos, signature, paymentProof } = require('../middleware/upload');

router.use(authMiddleware);

router.get('/', bookingsController.listMyBookings);
router.get('/:id', bookingsController.getBooking);
router.patch('/:id/assign-driver', requireRole('owner'), bookingsController.assignDriver);
router.patch('/:id/status', bookingsController.updateStatus);
router.patch('/:id/location', requireRole('driver'), validateCoordinates, bookingsController.updateLocation);
router.post('/:id/rate', validateRating, bookingsController.rateBooking);

// The driver check runs before any file bytes are accepted.
router.post(
  '/:id/delivery-proof',
  requireRole('driver'),
  deliveryProofController.loadProofBooking,
  photos(deliveryProofController.MAX_DELIVERY_PHOTOS),
  deliveryProofController.addDeliveryProof,
);
router.post(
  '/:id/signature',
  requireRole('driver'),
  deliveryProofController.loadProofBooking,
  signature(),
  deliveryProofController.addDeliverySignature,
);

// Payments between the shipper and the owner. A screenshot of the transfer
// can come in the multipart field "proof".
router.get('/:id/payments', paymentsController.listPayments);
router.post('/:id/payments', paymentProof(), validatePaymentRecord, paymentsController.recordPayment);
router.post('/:id/payments/:paymentId/confirm', paymentsController.confirmPayment);
router.post('/:id/payments/:paymentId/dispute', validatePaymentDispute, paymentsController.disputePayment);

module.exports = router;
