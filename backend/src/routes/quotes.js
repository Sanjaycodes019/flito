const express = require('express');
const router = express.Router();

const quotesController = require('../controllers/quotesController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { requireVerification } = require('../middleware/kyc');
const { validateCreateQuote, validateCounterOffer } = require('../middleware/validators');

router.use(authMiddleware);

router.post('/', requireRole('owner'), requireVerification('makeOffer'), validateCreateQuote, quotesController.createQuote);
router.get('/mine', requireRole('owner'), quotesController.listMyQuotes);

// Accept/counter/reject are open to both parties in the negotiation; the
// controller decides which side may act on the standing offer. Countering and
// accepting are offers, so an owner must be verified for them (shippers never
// are), while anyone can still walk away with reject.
router.patch('/:id/counter', requireVerification('makeOffer'), validateCounterOffer, quotesController.counterQuote);
router.patch('/:id/accept', requireVerification('makeOffer'), quotesController.acceptQuote);
router.patch('/:id/reject', quotesController.rejectQuote);

module.exports = router;
