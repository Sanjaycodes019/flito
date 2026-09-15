const express = require('express');
const router = express.Router();

const trucksController = require('../controllers/trucksController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateCreateTruck, validateUpdateTruck } = require('../middleware/validators');

router.use(authMiddleware, requireRole('owner'));

router.post('/', validateCreateTruck, trucksController.createTruck);
router.get('/', trucksController.listMyTrucks);
router.patch('/:id', validateUpdateTruck, trucksController.updateTruck);
router.patch('/:id/driver', trucksController.assignDriver);
router.delete('/:id', trucksController.deleteTruck);

module.exports = router;
