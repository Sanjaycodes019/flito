const express = require('express');
const router = express.Router();

const trucksController = require('../controllers/trucksController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateCreateTruck, validateUpdateTruck } = require('../middleware/validators');
const { document } = require('../middleware/upload');

router.use(authMiddleware, requireRole('owner'));

router.post('/', validateCreateTruck, trucksController.createTruck);
router.get('/', trucksController.listMyTrucks);
router.patch('/:id', validateUpdateTruck, trucksController.updateTruck);
router.patch('/:id/driver', trucksController.assignDriver);
router.delete('/:id', trucksController.deleteTruck);

// Verification papers. Ownership, verification status and storage are
// checked before any file bytes are accepted.
router.post(
  '/:id/documents',
  trucksController.loadEditableTruck,
  document(),
  trucksController.uploadTruckDocument,
);
router.delete('/:id/documents/:docId', trucksController.loadEditableTruck, trucksController.deleteTruckDocument);
router.post('/:id/verification', trucksController.submitTruckVerification);

module.exports = router;
