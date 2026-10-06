// FLITO's fees: what truck owners owe, the payments they record (which an
// admin confirms against FLITO's account, or rejects), and FLITO's own bank
// accounts and wallets that owners pay into.
const router = require('express').Router();
const User = require('../../models/User');
const CommissionCharge = require('../../models/CommissionCharge');
const CommissionPayment = require('../../models/CommissionPayment');
const payoutMethods = require('../../controllers/payoutMethodsController');
const { qrCode } = require('../../middleware/upload');
const { validatePayoutMethod } = require('../../middleware/validators');
const { summarize, paymentView, platformAccounts } = require('../../services/commission');
const { recordAdminAction } = require('../../services/audit');
const { sendPushToUser } = require('../../services/push');
const { fail } = require('../../utils/respond');
const {
  paginationParams, paginationMeta, searchClause, allOf, readReason, requireObjectId, PERSON_FIELDS, personSummary,
} = require('./helpers');

const PAYMENT_STATUSES = ['reported', 'confirmed', 'rejected'];
// How many owners the overview lists, most overdue first.
const OWNERS_SHOWN = 20;

const formatRs = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

router.param('paymentId', requireObjectId('ADMIN_COMMISSION_PAYMENT_NOT_FOUND', 'Payment not found'));

// Totals across every owner, the owners who owe the most, and FLITO's
// accounts. Worked out from each owner's months, the same way their own page
// is, so the two always agree.
router.get('/overview', async (req, res, next) => {
  try {
    const [months, payments, accounts] = await Promise.all([
      CommissionCharge.aggregate([
        { $group: { _id: { owner: '$ownerId', period: '$period' }, trips: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      CommissionPayment.find({ status: { $in: ['reported', 'confirmed'] } }).select('ownerId amount status'),
      platformAccounts(),
    ]);

    const byOwner = new Map();
    const entry = (id) => {
      const key = String(id);
      if (!byOwner.has(key)) byOwner.set(key, { months: [], payments: [] });
      return byOwner.get(key);
    };
    months.forEach(({ _id, trips, amount }) => entry(_id.owner).months.push({ period: _id.period, trips, amount }));
    payments.forEach((payment) => entry(payment.ownerId).payments.push(payment));

    const accountsByOwner = [...byOwner.entries()].map(([ownerId, data]) => ({ ownerId, ...summarize(data.months, data.payments) }));
    const owing = accountsByOwner
      .filter((account) => account.balance > 0)
      .sort((a, b) => b.overdue - a.overdue || b.balance - a.balance);

    const people = await User.find({ _id: { $in: owing.slice(0, OWNERS_SHOWN).map((account) => account.ownerId) } }).select(PERSON_FIELDS);
    const personOf = new Map(people.map((person) => [String(person._id), personSummary(person)]));

    const total = (key) => accountsByOwner.reduce((sum, account) => sum + account[key], 0);
    const awaiting = payments.filter((payment) => payment.status === 'reported');
    res.json({
      success: true,
      totals: {
        charged: total('charged'),
        paid: total('paid'),
        owed: total('balance'),
        overdue: total('overdue'),
        ownersOwing: owing.length,
        ownersOverdue: owing.filter((account) => account.overdue > 0).length,
        awaitingCount: awaiting.length,
        awaitingAmount: awaiting.reduce((sum, payment) => sum + payment.amount, 0),
      },
      owners: owing.slice(0, OWNERS_SHOWN).map((account) => ({
        owner: personOf.get(account.ownerId) || { _id: account.ownerId, name: null },
        balance: account.balance,
        payableNow: account.payableNow,
        overdue: account.overdue,
        awaiting: account.awaiting,
        dueDay: account.dueDay,
        blocked: account.blocked,
      })),
      accounts,
    });
  } catch (error) {
    next(error);
  }
});

// Owners' payments to FLITO, newest first. ?status= reported (default) |
// confirmed | rejected, and ?q= searches the owner's name, phone or company.
router.get('/payments', async (req, res, next) => {
  try {
    const { page, limit, skip } = paginationParams(req.query);
    const status = PAYMENT_STATUSES.includes(req.query.status) ? req.query.status : 'reported';
    const search = searchClause(req.query, ['firstName', 'lastName', 'email', 'phone', 'companyName']);
    const ownerIds = search ? (await User.find({ role: 'owner', ...search }).select('_id')).map((user) => user._id) : null;
    const filter = allOf({ status }, ownerIds ? { ownerId: { $in: ownerIds } } : null);

    const [payments, total] = await Promise.all([
      CommissionPayment.find(filter).populate('ownerId', PERSON_FIELDS).populate('reviewedBy', 'firstName lastName email')
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      CommissionPayment.countDocuments(filter),
    ]);
    res.json({
      success: true,
      payments: payments.map((payment) => ({
        ...paymentView(payment),
        owner: personSummary(payment.ownerId),
        reviewedBy: payment.reviewedBy ? personSummary(payment.reviewedBy)?.name : null,
      })),
      pagination: paginationMeta(page, limit, total),
    });
  } catch (error) {
    next(error);
  }
});

// Confirming says the money is in FLITO's account; it then pays off the
// owner's oldest fees. Only a payment still waiting can be answered, once.
const answer = (decide) => async (req, res, next) => {
  try {
    const decision = decide(req, res);
    if (!decision) return undefined;

    const payment = await CommissionPayment.findOneAndUpdate(
      { _id: req.params.paymentId, status: 'reported' },
      { $set: { ...decision.set, reviewedBy: req.user.userId, reviewedAt: new Date() } },
      { new: true },
    );
    if (!payment) {
      const exists = await CommissionPayment.exists({ _id: req.params.paymentId });
      return exists
        ? fail(res, 400, 'ADMIN_COMMISSION_ALREADY_ANSWERED', 'This payment has already been answered')
        : fail(res, 404, 'ADMIN_COMMISSION_PAYMENT_NOT_FOUND', 'Payment not found');
    }

    await recordAdminAction(req, {
      action: decision.action,
      targetType: 'user',
      targetId: payment.ownerId,
      reason: decision.set.rejectionReason,
      meta: { amount: payment.amount, paymentId: payment._id },
    });
    req.io?.to(`user-${payment.ownerId}`).emit('commission-updated', { paymentId: payment._id, status: payment.status });
    await sendPushToUser(payment.ownerId, decision.notice(payment));

    res.json({ success: true, payment: paymentView(payment) });
  } catch (error) {
    next(error);
  }
};

router.post('/payments/:paymentId/confirm', answer(() => ({
  set: { status: 'confirmed' },
  action: 'commission.payment_confirmed',
  notice: (payment) => ({
    title: 'Fee payment received',
    body: `FLITO received your payment of ${formatRs(payment.amount)}. Thank you!`,
    data: { type: 'commission' },
  }),
})));

router.post('/payments/:paymentId/reject', answer((req, res) => {
  const { reason, error, code, extra } = readReason(req.body, 'owner');
  if (error) {
    fail(res, 400, code, error, extra);
    return null;
  }
  return {
    set: { status: 'rejected', rejectionReason: reason },
    action: 'commission.payment_rejected',
    notice: (payment) => ({
      title: 'Fee payment not found',
      body: `FLITO couldn't find your payment of ${formatRs(payment.amount)}: ${reason}`,
      data: { type: 'commission' },
    }),
  };
}));

// FLITO's own bank accounts and wallets, with their official QR codes. The
// QR image comes in the multipart field "qr".
router.get('/accounts', payoutMethods.platform.list);
router.post('/accounts', qrCode(), validatePayoutMethod, payoutMethods.platform.add);
router.patch('/accounts/:methodId', qrCode(), validatePayoutMethod, payoutMethods.platform.update);
router.post('/accounts/:methodId/primary', payoutMethods.platform.setPrimary);
router.delete('/accounts/:methodId', payoutMethods.platform.remove);

module.exports = router;
