const User = require('../models/User');
const CommissionCharge = require('../models/CommissionCharge');
const CommissionPayment = require('../models/CommissionPayment');
const PlatformSettings = require('../models/PlatformSettings');
const storage = require('../services/storage');
const { payoutLabel } = require('../services/payoutView');
const { sendPushToUsers } = require('../services/push');
const {
  accountFor, paymentView, platformAccounts, welcomeTripsLeft, isChargeable,
} = require('../services/commission');
const {
  COMMISSION_DUE_DAY, BLOCK_OFFERS_WHEN_OVERDUE, welcomeTrips, commissionStartDay, commissionFor,
} = require('../config/commission');
const { fail } = require('../utils/respond');

const formatRs = (amount) => `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

// How many recent trips the fees page lists.
const RECENT_CHARGES = 100;

const stopName = (stop) => stop?.label || stop?.address || null;

const chargeView = (charge) => ({
  _id: charge._id,
  bookingId: charge.bookingId,
  goodsType: charge.loadId?.goodsType || null,
  from: stopName(charge.loadId?.pickupLocation),
  to: stopName(charge.loadId?.dropoffLocation),
  fare: charge.fare,
  amount: charge.amount,
  welcome: Boolean(charge.welcome),
  completedDay: charge.completedDay,
  period: charge.period,
});

// Everything the owner's FLITO fees page shows: how fees work, where they
// stand month by month, their trips and payments, and FLITO's accounts.
const respondWithAccount = async (res, ownerId, status = 200) => {
  const [account, charges, payTo] = await Promise.all([
    accountFor(ownerId),
    CommissionCharge.find({ ownerId })
      .populate('loadId', 'goodsType pickupLocation dropoffLocation')
      .sort({ completedDay: -1, createdAt: -1 })
      .limit(RECENT_CHARGES),
    platformAccounts(),
  ]);
  const { payments, ...summary } = account;
  res.status(status).json({
    success: true,
    // How fees work, without the rate: owners see each trip's fee, never
    // the formula behind it.
    rules: {
      dueDay: COMMISSION_DUE_DAY,
      blocksOffers: BLOCK_OFFERS_WHEN_OVERDUE,
      startsOn: commissionStartDay(),
      welcomeTrips: welcomeTrips(),
    },
    summary,
    charges: charges.map(chargeView),
    payments: payments.map(paymentView),
    payTo,
  });
};

// What FLITO's fee would be on a fare, for the owner deciding on an offer:
// the amount only. Nothing before fees start, nothing on a welcome trip.
exports.estimateCommission = async (req, res, next) => {
  try {
    const fare = Number.parseInt(req.query.fare, 10);
    if (!Number.isInteger(fare) || fare < 1) {
      return fail(res, 400, 'VALIDATION_PAYMENT_AMOUNT', 'fare must be a whole number of rupees');
    }
    let reason = null;
    if (!isChargeable({ createdAt: new Date() })) reason = 'notStarted';
    else if (await welcomeTripsLeft(req.user.userId) > 0) reason = 'welcome';
    res.json({ success: true, fare, amount: reason ? 0 : commissionFor(fare).amount, reason });
  } catch (error) {
    next(error);
  }
};

exports.getMyCommission = async (req, res, next) => {
  try {
    await respondWithAccount(res, req.user.userId);
  } catch (error) {
    next(error);
  }
};

// The owner records paying FLITO: into one of FLITO's accounts, or in cash.
// It counts once an admin confirms it.
exports.recordCommissionPayment = async (req, res, next) => {
  try {
    const ownerId = req.user.userId;
    const { amount, method, payoutMethodId, transactionId, note } = req.body;

    const { maxPayment } = await accountFor(ownerId);
    if (amount > maxPayment) {
      return fail(
        res,
        400,
        'COMMISSION_MORE_THAN_OWED',
        maxPayment ? `You owe FLITO ${formatRs(maxPayment)} at most right now` : "You don't owe FLITO anything right now",
        { max: maxPayment },
      );
    }

    let paidTo;
    let paidMethod = method;
    if (payoutMethodId) {
      const account = (await PlatformSettings.current()).payoutMethods.id(payoutMethodId);
      if (!account) return fail(res, 404, 'COMMISSION_ACCOUNT_NOT_FOUND', "That account isn't on FLITO's list any more");
      paidMethod = account.kind;
      paidTo = { kind: account.kind, label: payoutLabel(account) };
    }

    let proof;
    if (req.file) {
      if (!storage.isConfigured()) {
        return fail(res, 503, 'USERS_STORAGE_NOT_CONFIGURED', 'File uploads are not configured on this server');
      }
      proof = await storage.uploadPaymentImage(req.file, { folder: `flito/commission/${ownerId}` });
    }

    try {
      await CommissionPayment.create({
        ownerId, amount, method: paidMethod, paidTo, transactionId, note, proof,
      });
    } catch (error) {
      if (proof) await storage.deleteAssets([proof.publicId]);
      throw error;
    }

    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
    await sendPushToUsers(admins.map((admin) => admin._id), {
      title: 'Fee payment to confirm',
      body: `A truck owner says they paid FLITO ${formatRs(amount)}. Check FLITO's account and confirm it.`,
      data: { type: 'commissionPayment' },
    });

    await respondWithAccount(res, ownerId, 201);
  } catch (error) {
    next(error);
  }
};
