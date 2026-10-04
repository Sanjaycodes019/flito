const express = require('express');
const router = express.Router();

const quotesController = require('../controllers/quotesController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { requireVerification } = require('../middleware/kyc');
const { validateCreateQuote } = require('../middleware/validators');

router.use(authMiddleware);

router.post('/', requireRole('owner'), requireVerification('makeOffer'), validateCreateQuote, quotesController.createQuote);
router.get('/mine', requireRole('owner'), quotesController.listMyQuotes);

// Accept/reject are open to both parties; the controller decides which side
// may accept. There is no bargaining: an offer is taken or turned down at its
// price. Accepting books a truck, so an owner must be verified for it
// (shippers never are), while anyone can still walk away with reject.
router.patch('/:id/accept', requireVerification('makeOffer'), quotesController.acceptQuote);
router.patch('/:id/reject', quotesController.rejectQuote);

module.exports = router;
