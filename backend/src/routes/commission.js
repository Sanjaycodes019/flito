const express = require('express');
const router = express.Router();

const commissionController = require('../controllers/commissionController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validatePaymentRecord } = require('../middleware/validators');
const { paymentProof } = require('../middleware/upload');

// FLITO's fees, for the truck owner who owes them.
router.use(authMiddleware, requireRole('owner'));

router.get('/me', commissionController.getMyCommission);
// ?fare= : the fee on that fare, for an owner deciding on an offer.
router.get('/estimate', commissionController.estimateCommission);
// A screenshot of the transfer can come in the multipart field "proof".
router.post('/me/payments', paymentProof(), validatePaymentRecord, commissionController.recordCommissionPayment);

module.exports = router;
