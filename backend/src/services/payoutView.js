const { bankName } = require('../config/banks');

const WALLET_NAMES = { esewa: 'eSewa', khalti: 'Khalti' };

const lastFour = (number) => (number ? String(number).slice(-4) : null);

// The primary method first, then the rest in the order they were added.
const sortPayoutMethods = (methods = []) => [...methods].sort((a, b) => (
  Number(Boolean(b.primary)) - Number(Boolean(a.primary))
  || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
));

// A method as the owner, and the shippers they work with, see it: everything
// needed to pay, never the storage identifier of the QR image.
const payoutView = (method) => ({
  _id: method._id,
  kind: method.kind,
  bankCode: method.kind === 'bank' ? method.bankCode : undefined,
  bankName: method.kind === 'bank' ? bankName(method.bankCode, method.bankName) : undefined,
  branch: method.kind === 'bank' ? method.branch || null : undefined,
  accountNumber: method.kind === 'bank' ? method.accountNumber || null : undefined,
  walletId: method.kind === 'bank' ? undefined : method.walletId,
  accountName: method.accountName,
  qrUrl: method.qr?.url || null,
  primary: Boolean(method.primary),
});

const payoutList = (methods) => sortPayoutMethods(methods).map(payoutView);

// One line naming a method, for a payment record: "Nabil Bank •••• 1234",
// "eSewa 9841234567".
const payoutLabel = (method) => {
  if (method.kind === 'bank') {
    const tail = lastFour(method.accountNumber);
    return [bankName(method.bankCode, method.bankName), tail ? `•••• ${tail}` : 'QR'].join(' ');
  }
  return `${WALLET_NAMES[method.kind]} ${method.walletId}`;
};

// For the admin page: which methods an owner has, without full numbers.
const adminPayoutView = (method) => ({
  _id: method._id,
  kind: method.kind,
  name: method.kind === 'bank' ? bankName(method.bankCode, method.bankName) : WALLET_NAMES[method.kind],
  accountName: method.accountName,
  account: method.kind === 'bank'
    ? (method.accountNumber ? `•••• ${lastFour(method.accountNumber)}` : null)
    : `•••• ${lastFour(method.walletId)}`,
  hasQr: Boolean(method.qr?.url),
  primary: Boolean(method.primary),
});

module.exports = { sortPayoutMethods, payoutView, payoutList, payoutLabel, adminPayoutView };
