const express = require('express');
const router = express.Router();

const loadsController = require('../controllers/loadsController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateCreateLoad } = require('../middleware/validators');

router.use(authMiddleware);

router.post('/', requireRole('shipper'), validateCreateLoad, loadsController.createLoad);
router.get('/', loadsController.listLoads);
router.get('/:id', loadsController.getLoad);
router.get('/:id/quotes', requireRole('shipper'), loadsController.listQuotesForLoad);
router.patch('/:id/cancel', requireRole('shipper'), loadsController.cancelLoad);
router.patch('/:id/relist', requireRole('shipper'), loadsController.relistLoad);

module.exports = router;
