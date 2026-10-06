const { offerBlock } = require('../services/commission');

const formatRs = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

// Stops a truck owner with FLITO fees past their due date from taking on new
// trips (making an offer, or accepting one) until they pay. A payment they
// have recorded counts while an admin checks it. Shippers pass straight
// through; trips already booked are never affected.
const requireFeesPaid = async (req, res, next) => {
  try {
    if (req.user.role !== 'owner') return next();
    const block = await offerBlock(req.user.userId);
    if (!block) return next();
    res.status(403).json({
      success: false,
      code: 'COMMISSION_OVERDUE',
      message: `Pay FLITO's fees of ${formatRs(block.overdue)} that are past due before taking on new trips`,
      extra: { amount: block.overdue },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { requireFeesPaid };
