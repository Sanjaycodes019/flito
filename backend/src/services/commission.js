const mongoose = require('mongoose');
const logger = require('../utils/logger');
const CommissionCharge = require('../models/CommissionCharge');
const CommissionPayment = require('../models/CommissionPayment');
const PlatformSettings = require('../models/PlatformSettings');
const {
  commissionFor, commissionStartDay, COMMISSION_DUE_DAY, BLOCK_OFFERS_WHEN_OVERDUE, welcomeTrips,
} = require('../config/commission');
const { nepalDay } = require('./nepalTime');
const { bsMonthOf, nextBsMonth, bsToAd } = require('./bsCalendar');
const { payoutList } = require('./payoutView');

// FLITO's fees on completed trips, and what each truck owner owes.
//
// Every completed trip adds a charge, billed in the Nepali month it finished.
// A month's charges are due by the 15th of the next month. Payments the owner
// makes, once an admin confirms them, pay off the oldest month first.

// The day a month's fees are due: COMMISSION_DUE_DAY of the month after.
const dueDayOf = (period) => {
  const [year, month] = nextBsMonth(period).split('-').map(Number);
  return bsToAd(year, month, COMMISSION_DUE_DAY);
};

// Whether a booking carries FLITO's fee: only one made on or after the day
// fees started.
const isChargeable = (booking) => Boolean(booking.createdAt) && nepalDay(booking.createdAt) >= commissionStartDay();

// Adds the fee for a booking that has just been completed. Runs once per
// booking whatever happens: a second call (a retry, a race) changes nothing.
// A failure is logged rather than thrown, so it never undoes the delivery.
// How many of an owner's free welcome trips are left.
const welcomeTripsLeft = async (ownerId) => Math.max(
  0,
  welcomeTrips() - await CommissionCharge.countDocuments({ ownerId: ownerId?._id || ownerId }),
);

const chargeForBooking = async (booking, at = new Date()) => {
  try {
    const fare = booking.totalAmount || 0;
    if (fare <= 0 || !isChargeable(booking)) return;
    const { rate } = commissionFor(fare);
    // One of the owner's first trips under fees is free.
    const welcome = await welcomeTripsLeft(booking.ownerId) > 0;
    const amount = welcome ? 0 : commissionFor(fare).amount;
    const completedDay = nepalDay(at);
    await CommissionCharge.updateOne(
      { bookingId: booking._id },
      {
        $setOnInsert: {
          ownerId: booking.ownerId?._id || booking.ownerId,
          loadId: booking.loadId?._id || booking.loadId,
          fare,
          rate,
          amount,
          welcome,
          completedDay,
          period: bsMonthOf(completedDay),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error.code === 11000) return;
    logger.error(`[commission] could not charge booking ${booking._id}: ${error.message}`);
  }
};

const sumOf = (rows) => rows.reduce((total, row) => total + row.amount, 0);

// Where an owner stands, from their charges per month and their payments:
//
//   periods      each month with trips, newest first: what it came to, how much
//                of it is paid, and whether it is open (this month), due,
//                overdue or paid
//   charged      every fee so far
//   paid         confirmed payments
//   awaiting     payments still waiting for an admin to confirm
//   balance      charged - paid (never below zero)
//   payableNow   what is left on months that have ended
//   overdue      what is left on months past their due day
//   dueDay       the next day something is due by, if anything is
//   maxPayment   the most the owner can record paying now
//   blocked      whether new offers are stopped until they pay
const summarize = (months, payments, today = nepalDay()) => {
  const current = bsMonthOf(today);
  const confirmed = payments.filter((payment) => payment.status === 'confirmed');
  const awaiting = sumOf(payments.filter((payment) => payment.status === 'reported'));
  let unallocated = sumOf(confirmed);

  const periods = [...months]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(({ period, trips, amount }) => {
      const paid = Math.min(amount, unallocated);
      unallocated -= paid;
      const left = amount - paid;
      const dueDay = dueDayOf(period);
      const status = period >= current ? 'open'
        : left === 0 ? 'paid'
          : today > dueDay ? 'overdue' : 'due';
      return { period, trips, amount, paid, left, dueDay, status };
    });

  const charged = sumOf(periods);
  const paid = sumOf(confirmed);
  const balance = Math.max(0, charged - paid);
  const ended = periods.filter((row) => row.status === 'due' || row.status === 'overdue');
  const overdue = periods.filter((row) => row.status === 'overdue').reduce((total, row) => total + row.left, 0);
  const owing = periods.filter((row) => row.left > 0).map((row) => row.dueDay).sort();

  return {
    currentPeriod: current,
    periods: periods.reverse(),
    charged,
    paid,
    awaiting,
    balance,
    payableNow: ended.reduce((total, row) => total + row.left, 0),
    overdue,
    dueDay: owing[0] || null,
    maxPayment: Math.max(0, balance - awaiting),
    blocked: BLOCK_OFFERS_WHEN_OVERDUE && overdue - awaiting > 0,
  };
};

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Charges per month for one owner, as summarize() wants them.
const monthsFor = (ownerId) => CommissionCharge.aggregate([
  { $match: { ownerId: toObjectId(ownerId) } },
  { $group: { _id: '$period', trips: { $sum: 1 }, amount: { $sum: '$amount' } } },
  { $project: { _id: 0, period: '$_id', trips: 1, amount: 1 } },
]);

const accountFor = async (ownerId, today) => {
  const [months, payments, welcomeLeft] = await Promise.all([
    monthsFor(ownerId),
    CommissionPayment.find({ ownerId }).sort({ createdAt: -1 }),
    welcomeTripsLeft(ownerId),
  ]);
  return { ...summarize(months, payments, today), welcomeTripsLeft: welcomeLeft, payments };
};

// Whether an owner is stopped from new offers for unpaid fees, and how much.
const offerBlock = async (ownerId) => {
  if (!BLOCK_OFFERS_WHEN_OVERDUE) return null;
  const { blocked, overdue, awaiting } = await accountFor(ownerId);
  return blocked ? { overdue: overdue - awaiting } : null;
};

const paymentView = (payment) => ({
  _id: payment._id,
  amount: payment.amount,
  method: payment.method,
  paidTo: payment.paidTo?.label || null,
  transactionId: payment.transactionId || null,
  proofUrl: payment.proof?.url || null,
  note: payment.note || null,
  status: payment.status,
  rejectionReason: payment.status === 'rejected' ? payment.rejectionReason || null : null,
  createdAt: payment.createdAt,
  reviewedAt: payment.reviewedAt || null,
});

// FLITO's own accounts, where owners pay.
const platformAccounts = async () => payoutList((await PlatformSettings.current()).payoutMethods);

module.exports = {
  dueDayOf,
  isChargeable,
  welcomeTripsLeft,
  chargeForBooking,
  summarize,
  monthsFor,
  accountFor,
  offerBlock,
  paymentView,
  platformAccounts,
  commissionFor,
};
