const express = require('express');
const router = express.Router();

const loadsController = require('../controllers/loadsController');
const quotesController = require('../controllers/quotesController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateCreateLoad, validateRelist, validateTruckRequest } = require('../middleware/validators');
const { photos } = require('../middleware/upload');

router.use(authMiddleware);

router.post('/', requireRole('shipper'), validateCreateLoad, loadsController.createLoad);
router.get('/', loadsController.listLoads);
router.get('/:id', loadsController.getLoad);
router.get('/:id/quotes', requireRole('shipper'), loadsController.listQuotesForLoad);
router.patch('/:id/cancel', requireRole('shipper'), loadsController.cancelLoad);
router.patch('/:id/relist', requireRole('shipper'), validateRelist, loadsController.relistLoad);

// Choosing a truck: the shipper's ranked matches, and a request to one of them.
router.get('/:id/matches', requireRole('shipper'), loadsController.listTruckMatches);
router.post('/:id/requests', requireRole('shipper'), validateTruckRequest, quotesController.requestTruck);

// Which of an owner's trucks can carry this load, before they quote.
router.get('/:id/my-trucks', requireRole('owner'), loadsController.listMyTrucksForLoad);

// Ownership and status are checked before any file bytes are accepted.
router.post(
  '/:id/photos',
  requireRole('shipper'),
  loadsController.loadEditableOwnLoad,
  photos(loadsController.MAX_LOAD_PHOTOS),
  loadsController.addLoadPhotos,
);
router.delete(
  '/:id/photos/:photoId',
  requireRole('shipper'),
  loadsController.loadEditableOwnLoad,
  loadsController.deleteLoadPhoto,
);

module.exports = router;
