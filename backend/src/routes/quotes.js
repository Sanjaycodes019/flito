const express = require('express');
const router = express.Router();

const quotesController = require('../controllers/quotesController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { validateCreateQuote } = require('../middleware/validators');

router.use(authMiddleware);

router.post('/', requireRole('owner'), validateCreateQuote, quotesController.createQuote);
router.get('/mine', requireRole('owner'), quotesController.listMyQuotes);
router.patch('/:id/counter', quotesController.counterQuote);
router.patch('/:id/accept', requireRole('shipper'), quotesController.acceptQuote);
router.patch('/:id/reject', quotesController.rejectQuote);

module.exports = router;
