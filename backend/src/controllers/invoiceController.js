const jwt = require('jsonwebtoken');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { fail } = require('../utils/respond');
const { issueInvoice, invoiceFor } = require('../services/invoice');
const { renderInvoicePdf, invoiceFileName } = require('../services/invoicePdf');

// A completed trip's invoice, for its shipper and truck owner (the two sides
// of the payment; the driver isn't part of it).
//
// The app gets a short-lived link and opens it, so the phone's browser or the
// web page downloads the PDF itself, with no file handling in the app. The
// link's token is signed with its own secret, so it can only ever fetch this
// one invoice and is no good as a login token.

const LINK_TTL = '10m';
const linkSecret = () => `${process.env.JWT_SECRET}:invoice-link`;

const idOf = (ref) => (ref ? String(ref._id || ref) : null);
const isPayingParty = (booking, userId) => [booking.shipperId, booking.ownerId].some((ref) => idOf(ref) === userId);

// Loads a completed booking the user may have the invoice for, or answers
// with why not.
const loadInvoiceBooking = async (res, bookingId, userId) => {
  const booking = await Booking.findById(bookingId).select('shipperId ownerId status invoice completedAt updatedAt');
  if (!booking) {
    fail(res, 404, 'BOOKINGS_NOT_FOUND', 'Booking not found');
    return null;
  }
  if (!isPayingParty(booking, userId)) {
    fail(res, 403, 'INVOICE_NOT_PARTY', 'Only the shipper and the truck owner can get the invoice for this trip');
    return null;
  }
  if (booking.status !== 'completed') {
    fail(res, 400, 'INVOICE_NOT_COMPLETED', 'The invoice is ready once the trip is delivered');
    return null;
  }
  // Trips completed before invoices existed get their number now.
  return booking.invoice?.number ? booking : issueInvoice(booking);
};

// POST /bookings/:id/invoice-link → a path, relative to the API, to download from.
exports.createInvoiceLink = async (req, res, next) => {
  try {
    const booking = await loadInvoiceBooking(res, req.params.id, req.user.userId);
    if (!booking) return undefined;
    if (!booking.invoice?.number) {
      return fail(res, 503, 'INVOICE_NOT_READY', "The invoice couldn't be prepared. Try again in a moment.");
    }

    const token = jwt.sign(
      { userId: req.user.userId, bookingId: String(booking._id) },
      linkSecret(),
      { expiresIn: LINK_TTL },
    );
    res.json({
      success: true,
      invoice: { number: booking.invoice.number, issuedAt: booking.invoice.issuedAt },
      fileName: invoiceFileName(booking.invoice.number),
      path: `/bookings/${booking._id}/invoice.pdf?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /bookings/:id/invoice.pdf?token=… → the PDF itself.
exports.downloadInvoice = async (req, res, next) => {
  let claims;
  try {
    claims = jwt.verify(String(req.query.token || ''), linkSecret());
  } catch {
    return fail(res, 401, 'INVOICE_LINK_EXPIRED', 'This invoice link has expired. Download it again from the trip.');
  }
  if (claims.bookingId !== req.params.id) {
    return fail(res, 401, 'INVOICE_LINK_EXPIRED', 'This invoice link has expired. Download it again from the trip.');
  }

  try {
    // Checked again, so a link stops working if the account is suspended.
    const account = await User.findById(claims.userId).select('status');
    if (!account || (account.status || 'active') !== 'active') {
      return fail(res, 403, 'AUTH_ACCOUNT_STATUS', 'This account can no longer download invoices');
    }
    const booking = await loadInvoiceBooking(res, req.params.id, claims.userId);
    if (!booking) return undefined;

    const invoice = await invoiceFor(booking._id);
    const pdf = await renderInvoicePdf(invoice);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceFileName(invoice.number)}"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'private, no-store',
    });
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};
