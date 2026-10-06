const axios = require('axios');
const logger = require('../utils/logger');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Counter = require('../models/Counter');
const { nepalDay } = require('./nepalTime');
const { adToBs } = require('./bsCalendar');
const { describeAddress } = require('./nepalLocations');
const { payoutList } = require('./payoutView');

// The invoice for a completed trip: the truck owner billing the shipper for
// the fare agreed on FLITO. FLITO doesn't take the money (see Payment), so the
// invoice is the owner's, and it shows what the shipper has paid them so far.
//
// Numbers run per Nepali fiscal year, which starts on 1 Shrawan:
// "FL/2083-84/00042" is the 42nd invoice of fiscal year 2083/84.

// The fiscal year a day falls in, as "2083-84".
const fiscalYearOf = (day) => {
  const bs = adToBs(day);
  if (!bs) return day.slice(0, 4);
  const start = bs.month >= 4 ? bs.year : bs.year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

const completedAtOf = (booking) => booking.completedAt || booking.updatedAt || new Date();

// Numbers a completed booking's invoice, once. Safe to call again (or twice
// at once): the booking keeps whichever number reached it first. A failure
// is logged rather than thrown, so it never undoes the delivery.
const issueInvoice = async (booking) => {
  if (booking.invoice?.number) return booking;
  try {
    const issuedAt = completedAtOf(booking);
    const fiscalYear = fiscalYearOf(nepalDay(issuedAt));
    const seq = await Counter.nextSequence(`invoice-${fiscalYear}`);
    const number = `FL/${fiscalYear}/${String(seq).padStart(5, '0')}`;
    const updated = await Booking.findOneAndUpdate(
      { _id: booking._id, 'invoice.number': { $exists: false } },
      { $set: { invoice: { number, issuedAt } } },
      { new: true },
    );
    return updated || await Booking.findById(booking._id);
  } catch (error) {
    logger.error(`[invoice] could not number booking ${booking._id}: ${error.message}`);
    return booking;
  }
};

const fullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

const partyOf = (user) => {
  if (!user) return null;
  const address = describeAddress(user.address);
  return {
    name: user.companyName || fullName(user) || 'FLITO user',
    contact: user.companyName ? fullName(user) : null,
    phone: user.phone || null,
    email: user.email || null,
    address: address?.formatted || null,
  };
};

const stopOf = (stop) => (stop ? {
  label: stop.label || stop.address || null,
  address: stop.address || null,
  contact: [stop.contactPerson, stop.phone].filter(Boolean).join(', ') || null,
} : null);

// The delivery signature as image bytes for the PDF, or null. It is our own
// upload, served with f_auto, so PNG or JPEG is asked for (all PDFs can hold).
// Never blocks the invoice: a slow or failed fetch just leaves it out.
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;
const fetchSignature = async (url) => {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const { data } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 4000,
      maxContentLength: SIGNATURE_MAX_BYTES,
      headers: { Accept: 'image/png,image/jpeg' },
    });
    const bytes = Buffer.from(data);
    const isPng = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    return isPng || isJpeg ? bytes : null;
  } catch (error) {
    logger.warn(`[invoice] could not fetch delivery signature: ${error.message}`);
    return null;
  }
};

const USER_FIELDS = 'firstName lastName companyName phone email address';

// Everything the PDF shows, for a completed booking.
const invoiceFor = async (bookingId) => {
  const booking = await Booking.findById(bookingId)
    .populate('loadId')
    .populate('shipperId', USER_FIELDS)
    .populate('ownerId', `${USER_FIELDS} payoutMethods`)
    .populate('driverId', 'firstName lastName')
    .populate('truckId', 'registrationNumber truckType bodyType capacity makeModel');
  if (!booking) return null;

  const [payments, signature] = await Promise.all([
    Payment.find({ bookingId: booking._id, status: 'completed' }).sort({ confirmedAt: 1, createdAt: 1 }),
    fetchSignature(booking.deliverySignature?.url),
  ]);

  const load = booking.loadId || {};
  const total = booking.totalAmount || 0;
  const paid = Math.min(total, payments.reduce((sum, p) => sum + p.amount, 0));
  const due = Math.max(0, total - paid);

  return {
    number: booking.invoice?.number,
    issuedAt: booking.invoice?.issuedAt || completedAtOf(booking),
    completedAt: completedAtOf(booking),
    bookedAt: booking.createdAt,
    reference: String(booking._id).slice(-8).toUpperCase(),
    owner: partyOf(booking.ownerId),
    shipper: partyOf(booking.shipperId),
    trip: {
      pickup: stopOf(load.pickupLocation),
      dropoff: stopOf(load.dropoffLocation),
      pickupDay: load.pickupDay || (load.preferredPickupDate ? nepalDay(load.preferredPickupDate) : null),
      distanceKm: load.distanceKm || null,
      distanceEstimated: load.distanceSource === 'estimate',
      goodsType: load.goodsType || null,
      description: load.description || null,
      weight: load.weight || null,
      quantity: load.quantity || null,
      volume: load.volume || null,
      truck: booking.truckId ? {
        registrationNumber: booking.truckId.registrationNumber,
        truckType: booking.truckId.truckType,
        bodyType: booking.truckId.bodyType,
        makeModel: booking.truckId.makeModel,
      } : null,
      driver: booking.driverId ? fullName(booking.driverId) : null,
    },
    amounts: { total, paid, due },
    payments: payments.map((p) => ({
      date: p.confirmedAt || p.createdAt,
      method: p.method,
      reference: p.transactionId || null,
      paidTo: p.paidTo?.label || null,
      amount: p.amount,
    })),
    // Where the rest can be paid, only while something is left.
    payTo: due > 0 && booking.ownerId ? payoutList(booking.ownerId.payoutMethods).slice(0, 2) : [],
    delivery: {
      signature,
      signedAt: booking.deliverySignature?.capturedAt || null,
      photos: booking.deliveryPhotos?.length || 0,
    },
  };
};

module.exports = { issueInvoice, invoiceFor, fiscalYearOf };
