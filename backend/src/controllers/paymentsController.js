const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const User = require('../models/User');
const storage = require('../services/storage');
const { payoutList, payoutLabel } = require('../services/payoutView');
const { sendPushToUser } = require('../services/push');
const { fail } = require('../utils/respond');

// FLITO doesn't hold the money for a trip. The shipper pays the owner straight
// into one of the owner's accounts (or in cash), says so here, and the owner
// confirms it arrived. Only confirmed payments count towards what is paid.

const idOf = (ref) => (ref ? String(ref._id || ref) : null);

const partyOf = (booking, userId) => {
  if (idOf(booking.shipperId) === userId) return 'shipper';
  if (idOf(booking.ownerId) === userId) return 'owner';
  return null;
};

const formatRs = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

const paymentView = (payment) => ({
  _id: payment._id,
  amount: payment.amount,
  method: payment.method,
  status: payment.status,
  recordedBy: payment.recordedBy && idOf(payment.recordedBy) === idOf(payment.payeeId) ? 'owner' : 'shipper',
  paidTo: payment.paidTo?.label || null,
  transactionId: payment.transactionId || null,
  proofUrl: payment.proof?.url || null,
  note: payment.note || null,
  disputeReason: payment.disputeReason || null,
  createdAt: payment.createdAt,
  confirmedAt: payment.confirmedAt || null,
});

// What is paid, what is waiting for the owner, and what is left to pay.
const summaryOf = (booking, payments) => {
  const total = booking.totalAmount || 0;
  const paid = booking.amountPaid || 0;
  const awaiting = payments.filter((p) => p.status === 'reported').reduce((sum, p) => sum + p.amount, 0);
  return {
    total,
    paid,
    awaitingConfirmation: awaiting,
    due: Math.max(0, total - paid),
    status: booking.paymentStatus || 'pending',
  };
};

// Loads the booking for one of its two parties. The driver doesn't take part
// in payments, and nobody else may see them.
const loadForParty = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    fail(res, 404, 'BOOKINGS_NOT_FOUND', 'Booking not found');
    return {};
  }
  const party = partyOf(booking, req.user.userId);
  if (!party) {
    fail(res, 403, 'PAYMENTS_NOT_PARTY', 'Only the shipper and the truck owner can see payments for this booking');
    return {};
  }
  return { booking, party };
};

const respondWithPayments = async (res, booking, party, status = 200) => {
  const [payments, owner] = await Promise.all([
    Payment.find({ bookingId: booking._id }).sort({ createdAt: -1 }),
    // A cancelled booking has nothing left to pay, so the owner's accounts are
    // no longer shown to the shipper.
    booking.status === 'cancelled' ? null : User.findById(booking.ownerId).select('payoutMethods'),
  ]);
  res.status(status).json({
    success: true,
    party,
    summary: summaryOf(booking, payments),
    payTo: owner ? payoutList(owner.payoutMethods) : [],
    payments: payments.map(paymentView),
  });
};

// Adds a confirmed amount to the booking in one update, so two confirmations
// landing together both count.
const applyToBooking = (bookingId, { amount, method }) => Booking.findOneAndUpdate(
  { _id: bookingId },
  [
    { $set: { amountPaid: { $add: [{ $ifNull: ['$amountPaid', 0] }, amount] }, paymentMethod: method } },
    {
      $set: {
        amountPending: { $max: [0, { $subtract: [{ $ifNull: ['$totalAmount', 0] }, '$amountPaid'] }] },
        paymentStatus: { $cond: [{ $gte: ['$amountPaid', { $ifNull: ['$totalAmount', 0] }] }, 'completed', 'partial'] },
      },
    },
  ],
  { new: true },
);

const tellParties = (req, booking) => {
  [booking.shipperId, booking.ownerId].forEach((id) => req.io?.to(`user-${idOf(id)}`)
    .emit('booking-payment-updated', { bookingId: booking._id }));
};

exports.listPayments = async (req, res, next) => {
  try {
    const { booking, party } = await loadForParty(req, res);
    if (!booking) return undefined;
    await respondWithPayments(res, booking, party);
  } catch (error) {
    next(error);
  }
};

// The shipper reports a payment they made, which then waits for the owner. The
// owner records one they received (cash handed to the driver, say), which is
// confirmed straight away.
exports.recordPayment = async (req, res, next) => {
  try {
    const { booking, party } = await loadForParty(req, res);
    if (!booking) return undefined;
    if (booking.status === 'cancelled') {
      return fail(res, 400, 'PAYMENTS_BOOKING_CANCELLED', 'This booking was cancelled, so there is nothing to pay');
    }

    const { amount, method, payoutMethodId, transactionId, note } = req.body;

    // A reported payment that is still waiting counts against what the
    // shipper can report next, so the same transfer isn't entered twice.
    const awaiting = party === 'shipper'
      ? (await Payment.find({ bookingId: booking._id, status: 'reported' }).select('amount'))
        .reduce((sum, p) => sum + p.amount, 0)
      : 0;
    const due = Math.max(0, (booking.totalAmount || 0) - (booking.amountPaid || 0) - awaiting);
    if (amount > due) {
      return fail(
        res,
        400,
        'PAYMENTS_MORE_THAN_DUE',
        due ? `Only ${formatRs(due)} is left to pay on this booking` : 'Nothing is left to pay on this booking',
        { due },
      );
    }

    let paidTo;
    let paidMethod = method;
    if (payoutMethodId) {
      const owner = await User.findById(booking.ownerId).select('payoutMethods');
      const account = owner?.payoutMethods.id(payoutMethodId);
      if (!account) return fail(res, 404, 'PAYMENTS_ACCOUNT_NOT_FOUND', "That account isn't on the owner's list any more");
      paidMethod = account.kind;
      paidTo = { kind: account.kind, label: payoutLabel(account) };
    }

    let proof;
    if (req.file) {
      if (!storage.isConfigured()) {
        return fail(res, 503, 'USERS_STORAGE_NOT_CONFIGURED', 'File uploads are not configured on this server');
      }
      proof = await storage.uploadPaymentImage(req.file, { folder: `flito/payments/${booking._id}` });
    }

    const confirmed = party === 'owner';
    let payment;
    try {
      payment = await Payment.create({
        bookingId: booking._id,
        payerId: booking.shipperId,
        payeeId: booking.ownerId,
        amount,
        method: paidMethod,
        status: confirmed ? 'completed' : 'reported',
        recordedBy: req.user.userId,
        paidTo,
        transactionId,
        note,
        proof,
        confirmedAt: confirmed ? new Date() : undefined,
      });
    } catch (error) {
      if (proof) await storage.deleteAssets([proof.publicId]);
      throw error;
    }

    const updated = confirmed ? await applyToBooking(booking._id, payment) : booking;
    tellParties(req, updated);
    await sendPushToUser(confirmed ? booking.shipperId : booking.ownerId, confirmed
      ? {
        title: 'Payment recorded',
        body: `The truck owner recorded ${formatRs(amount)} received`,
        data: { type: 'booking', bookingId: String(booking._id) },
      }
      : {
        title: 'Payment to confirm',
        body: `The shipper says they paid you ${formatRs(amount)}. Check and confirm it.`,
        data: { type: 'booking', bookingId: String(booking._id) },
      });

    await respondWithPayments(res, updated, party, 201);
  } catch (error) {
    next(error);
  }
};

// Only the owner can say whether money reached their account.
const loadReportedPayment = async (req, res) => {
  const { booking, party } = await loadForParty(req, res);
  if (!booking) return {};
  if (party !== 'owner') {
    fail(res, 403, 'PAYMENTS_OWNER_ONLY', 'Only the truck owner can confirm a payment arrived');
    return {};
  }
  const payment = await Payment.findOne({ _id: req.params.paymentId, bookingId: booking._id });
  if (!payment) {
    fail(res, 404, 'PAYMENTS_NOT_FOUND', 'Payment not found');
    return {};
  }
  if (payment.status !== 'reported') {
    fail(res, 400, 'PAYMENTS_ALREADY_ANSWERED', 'This payment has already been answered', { status: payment.status });
    return {};
  }
  return { booking, party, payment };
};

exports.confirmPayment = async (req, res, next) => {
  try {
    const { booking, party, payment } = await loadReportedPayment(req, res);
    if (!payment) return undefined;

    const due = Math.max(0, (booking.totalAmount || 0) - (booking.amountPaid || 0));
    if (payment.amount > due) {
      return fail(
        res,
        400,
        'PAYMENTS_MORE_THAN_DUE',
        due ? `Only ${formatRs(due)} is left to pay on this booking` : 'Nothing is left to pay on this booking',
        { due },
      );
    }

    // Conditional on it still waiting, so a double tap can't count it twice.
    const answered = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'reported' },
      { $set: { status: 'completed', confirmedAt: new Date() } },
      { new: true },
    );
    if (!answered) return fail(res, 400, 'PAYMENTS_ALREADY_ANSWERED', 'This payment has already been answered');

    const updated = await applyToBooking(booking._id, answered);
    tellParties(req, updated);
    await sendPushToUser(booking.shipperId, {
      title: 'Payment received',
      body: `The truck owner confirmed your payment of ${formatRs(answered.amount)}`,
      data: { type: 'booking', bookingId: String(booking._id) },
    });

    await respondWithPayments(res, updated, party);
  } catch (error) {
    next(error);
  }
};

exports.disputePayment = async (req, res, next) => {
  try {
    const { booking, party, payment } = await loadReportedPayment(req, res);
    if (!payment) return undefined;

    const answered = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'reported' },
      { $set: { status: 'disputed', disputedAt: new Date(), disputeReason: req.body.reason } },
      { new: true },
    );
    if (!answered) return fail(res, 400, 'PAYMENTS_ALREADY_ANSWERED', 'This payment has already been answered');

    tellParties(req, booking);
    await sendPushToUser(booking.shipperId, {
      title: 'Payment not received',
      body: `The truck owner says ${formatRs(answered.amount)} hasn't reached them. Check the transfer and talk to them.`,
      data: { type: 'booking', bookingId: String(booking._id) },
    });

    await respondWithPayments(res, booking, party);
  } catch (error) {
    next(error);
  }
};
