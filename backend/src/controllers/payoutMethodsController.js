const User = require('../models/User');
const storage = require('../services/storage');
const { payoutList } = require('../services/payoutView');
const { OTHER_BANK } = require('../config/banks');
const { fail } = require('../utils/respond');

// An owner keeps a few ways to be paid, not a directory of accounts.
const MAX_PAYOUT_METHODS = 5;

// The fields each kind of method keeps.
const FIELDS_BY_KIND = {
  bank: ['bankCode', 'bankName', 'branch', 'accountNumber', 'accountName'],
  esewa: ['walletId', 'accountName'],
  khalti: ['walletId', 'accountName'],
};

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

// What a method still needs before shippers can pay into it, or null when it
// is complete. A bank needs the account number or its QR (many owners only
// have the QR their bank app shows); a wallet always needs its number.
const incompleteReason = (method) => {
  if (!method.accountName) return ['PAYOUT_NAME_REQUIRED', 'Add the name on the account'];
  if (method.kind === 'bank') {
    if (!method.bankCode) return ['PAYOUT_BANK_REQUIRED', 'Choose the bank'];
    if (method.bankCode === OTHER_BANK && !method.bankName) return ['PAYOUT_BANK_NAME_REQUIRED', 'Type the name of the bank'];
    if (!method.accountNumber && !method.qr?.url) {
      return ['PAYOUT_ACCOUNT_OR_QR_REQUIRED', 'Add the account number, a photo of the QR code, or both'];
    }
    return null;
  }
  if (!method.walletId) return ['PAYOUT_WALLET_ID_REQUIRED', 'Add the mobile number of the wallet'];
  return null;
};

// Keeps exactly one method marked primary whenever there are any.
const settlePrimary = (methods, primaryId) => {
  const target = primaryId
    ? methods.find((method) => String(method._id) === String(primaryId))
    : methods.find((method) => method.primary) || methods[0];
  methods.forEach((method) => { method.primary = Boolean(target) && method === target; });
};

const respondWith = (res, user, status = 200) => res.status(status).json({
  success: true,
  payoutMethods: payoutList(user.payoutMethods),
});

const uploadQr = async (req) => {
  if (!req.file) return null;
  if (!storage.isConfigured()) {
    const err = new Error('File uploads are not configured on this server');
    err.status = 503;
    err.code = 'USERS_STORAGE_NOT_CONFIGURED';
    throw err;
  }
  return storage.uploadPaymentImage(req.file, { folder: `flito/payout/${req.user.userId}` });
};

// Saves the owner, deleting a just-uploaded QR again if that fails, so a
// refused change leaves no file behind.
const saveOrDiscard = async (user, uploaded) => {
  try {
    await user.save();
  } catch (error) {
    if (uploaded) await storage.deleteAssets([uploaded.publicId]);
    throw error;
  }
};

const storageFailure = (res, error) => (
  error.code === 'USERS_STORAGE_NOT_CONFIGURED' ? fail(res, 503, error.code, error.message) : null
);

exports.listPayoutMethods = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('payoutMethods');
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
    respondWith(res, user);
  } catch (error) {
    next(error);
  }
};

exports.addPayoutMethod = async (req, res, next) => {
  try {
    const { kind } = req.body;
    if (!kind) return fail(res, 400, 'VALIDATION_PAYOUT_KIND', 'Choose bank, eSewa or Khalti');

    const user = await User.findById(req.user.userId).select('payoutMethods');
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
    if (user.payoutMethods.length >= MAX_PAYOUT_METHODS) {
      return fail(res, 400, 'PAYOUT_LIMIT', `You can keep up to ${MAX_PAYOUT_METHODS} ways to be paid. Remove one first.`, { max: MAX_PAYOUT_METHODS });
    }

    const draft = { kind, ...pick(req.body, FIELDS_BY_KIND[kind]) };
    if (draft.bankCode !== OTHER_BANK) delete draft.bankName;
    if (!draft.branch) delete draft.branch;
    // Checked before the QR is stored; an attached QR counts as one.
    const problem = incompleteReason({ ...draft, qr: req.file ? { url: 'attached' } : undefined });
    if (problem) return fail(res, 400, ...problem);

    const uploaded = await uploadQr(req);
    user.payoutMethods.push({ ...draft, qr: uploaded || undefined });
    settlePrimary(user.payoutMethods);
    await saveOrDiscard(user, uploaded);

    respondWith(res, user, 201);
  } catch (error) {
    if (storageFailure(res, error)) return undefined;
    next(error);
  }
};

exports.updatePayoutMethod = async (req, res, next) => {
  try {
    const { kind, removeQr } = req.body;
    const user = await User.findById(req.user.userId).select('payoutMethods');
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

    const method = user.payoutMethods.id(req.params.methodId);
    if (!method) return fail(res, 404, 'PAYOUT_NOT_FOUND', 'That payment method was not found');
    if (kind && kind !== method.kind) {
      return fail(res, 400, 'PAYOUT_KIND_LOCKED', 'Add a new one instead of changing a bank into a wallet');
    }

    const before = method.qr?.publicId || null;
    // Only the fields this kind keeps; an empty value clears an optional one.
    Object.entries(pick(req.body, FIELDS_BY_KIND[method.kind])).forEach(([key, value]) => {
      method[key] = value || undefined;
    });
    if (method.kind === 'bank' && method.bankCode !== OTHER_BANK) method.bankName = undefined;

    const removing = removeQr && !req.file;
    const problem = incompleteReason({
      kind: method.kind,
      bankCode: method.bankCode,
      bankName: method.bankName,
      accountNumber: method.accountNumber,
      accountName: method.accountName,
      walletId: method.walletId,
      qr: req.file ? { url: 'attached' } : removing ? undefined : method.qr,
    });
    if (problem) return fail(res, 400, ...problem);

    const uploaded = await uploadQr(req);
    if (uploaded) method.qr = uploaded;
    else if (removing) method.qr = undefined;

    await saveOrDiscard(user, uploaded);
    if (before && (uploaded || removing)) await storage.deleteAssets([before]);

    respondWith(res, user);
  } catch (error) {
    if (storageFailure(res, error)) return undefined;
    next(error);
  }
};

exports.setPrimaryPayoutMethod = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('payoutMethods');
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
    if (!user.payoutMethods.id(req.params.methodId)) {
      return fail(res, 404, 'PAYOUT_NOT_FOUND', 'That payment method was not found');
    }

    settlePrimary(user.payoutMethods, req.params.methodId);
    await user.save();
    respondWith(res, user);
  } catch (error) {
    next(error);
  }
};

exports.deletePayoutMethod = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('payoutMethods');
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

    const method = user.payoutMethods.id(req.params.methodId);
    if (!method) return fail(res, 404, 'PAYOUT_NOT_FOUND', 'That payment method was not found');

    const qrId = method.qr?.publicId;
    method.deleteOne();
    settlePrimary(user.payoutMethods);
    await user.save();
    if (qrId) await storage.deleteAssets([qrId]);

    respondWith(res, user);
  } catch (error) {
    next(error);
  }
};

exports.MAX_PAYOUT_METHODS = MAX_PAYOUT_METHODS;
