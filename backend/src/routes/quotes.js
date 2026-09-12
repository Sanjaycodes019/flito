const express = require('express');
const router = express.Router();

const quotesController = require('../controllers/quotesController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateCreateQuote, validateCounterOffer } = require('../middleware/validators');

router.use(authMiddleware);

router.post('/', requireRole('owner'), validateCreateQuote, quotesController.createQuote);
router.get('/mine', requireRole('owner'), quotesController.listMyQuotes);
// Accept/counter/reject are open to both parties in the negotiation; the
// controller decides which side is allowed to act on the standing offer.
router.patch('/:id/counter', validateCounterOffer, quotesController.counterQuote);
router.patch('/:id/accept', quotesController.acceptQuote);
router.patch('/:id/reject', quotesController.rejectQuote);

module.exports = router;
