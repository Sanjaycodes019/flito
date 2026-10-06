const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const storage = require('../services/storage');
const { payoutList } = require('../services/payoutView');
const { OTHER_BANK } = require('../config/banks');
const { recordAdminAction } = require('../services/audit');
const { fail } = require('../utils/respond');

// The bank accounts and wallets something can be paid into: a truck owner's
// own (shippers pay them) and FLITO's (owners pay FLITO's fees). The same
// handlers serve both; see `handlersFor` at the bottom.

// A few ways to be paid, not a directory of accounts.
const MAX_PAYOUT_METHODS = 5;

// The fields each kind of method keeps.
const FIELDS_BY_KIND = {
  bank: ['bankCode', 'bankName', 'branch', 'accountNumber', 'accountName'],
  esewa: ['walletId', 'accountName'],
  khalti: ['walletId', 'accountName'],
};

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

// What a method still needs before anyone can pay into it, or null when it
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

const respondWith = (res, holder, status = 200) => res.status(status).json({
  success: true,
  payoutMethods: payoutList(holder.payoutMethods),
});

const uploadQr = async (req, folder) => {
  if (!req.file) return null;
  if (!storage.isConfigured()) {
    const err = new Error('File uploads are not configured on this server');
    err.status = 503;
    err.code = 'USERS_STORAGE_NOT_CONFIGURED';
    throw err;
  }
  return storage.uploadPaymentImage(req.file, { folder });
};

// Saves the holder, deleting a just-uploaded QR again if that fails, so a
// refused change leaves no file behind.
const saveOrDiscard = async (holder, uploaded) => {
  try {
    await holder.save();
  } catch (error) {
    if (uploaded) await storage.deleteAssets([uploaded.publicId]);
    throw error;
  }
};

const storageFailure = (res, error) => (
  error.code === 'USERS_STORAGE_NOT_CONFIGURED' ? fail(res, 503, error.code, error.message) : null
);

// The five handlers for one holder of payout methods. `load(req)` returns the
// document holding them (null when it is gone), `folder(req)` is where its QR
// images are stored, and `changed(req, holder)` runs after every change.
const handlersFor = ({ load, folder, changed = async () => {} }) => {
  const list = async (req, res, next) => {
    try {
      const holder = await load(req);
      if (!holder) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
      respondWith(res, holder);
    } catch (error) {
      next(error);
    }
  };

  const add = async (req, res, next) => {
    try {
      const { kind } = req.body;
      if (!kind) return fail(res, 400, 'VALIDATION_PAYOUT_KIND', 'Choose bank, eSewa or Khalti');

      const holder = await load(req);
      if (!holder) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
      if (holder.payoutMethods.length >= MAX_PAYOUT_METHODS) {
        return fail(res, 400, 'PAYOUT_LIMIT', `You can keep up to ${MAX_PAYOUT_METHODS} ways to be paid. Remove one first.`, { max: MAX_PAYOUT_METHODS });
      }

      const draft = { kind, ...pick(req.body, FIELDS_BY_KIND[kind]) };
      if (draft.bankCode !== OTHER_BANK) delete draft.bankName;
      if (!draft.branch) delete draft.branch;
      // Checked before the QR is stored; an attached QR counts as one.
      const problem = incompleteReason({ ...draft, qr: req.file ? { url: 'attached' } : undefined });
      if (problem) return fail(res, 400, ...problem);

      const uploaded = await uploadQr(req, folder(req));
      holder.payoutMethods.push({ ...draft, qr: uploaded || undefined });
      settlePrimary(holder.payoutMethods);
      await saveOrDiscard(holder, uploaded);
      await changed(req, holder);

      respondWith(res, holder, 201);
    } catch (error) {
      if (storageFailure(res, error)) return undefined;
      next(error);
    }
  };

  const update = async (req, res, next) => {
    try {
      const { kind, removeQr } = req.body;
      const holder = await load(req);
      if (!holder) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

      const method = holder.payoutMethods.id(req.params.methodId);
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

      const uploaded = await uploadQr(req, folder(req));
      if (uploaded) method.qr = uploaded;
      else if (removing) method.qr = undefined;

      await saveOrDiscard(holder, uploaded);
      if (before && (uploaded || removing)) await storage.deleteAssets([before]);
      await changed(req, holder);

      respondWith(res, holder);
    } catch (error) {
      if (storageFailure(res, error)) return undefined;
      next(error);
    }
  };

  const setPrimary = async (req, res, next) => {
    try {
      const holder = await load(req);
      if (!holder) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
      if (!holder.payoutMethods.id(req.params.methodId)) {
        return fail(res, 404, 'PAYOUT_NOT_FOUND', 'That payment method was not found');
      }

      settlePrimary(holder.payoutMethods, req.params.methodId);
      await holder.save();
      await changed(req, holder);
      respondWith(res, holder);
    } catch (error) {
      next(error);
    }
  };

  const remove = async (req, res, next) => {
    try {
      const holder = await load(req);
      if (!holder) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

      const method = holder.payoutMethods.id(req.params.methodId);
      if (!method) return fail(res, 404, 'PAYOUT_NOT_FOUND', 'That payment method was not found');

      const qrId = method.qr?.publicId;
      method.deleteOne();
      settlePrimary(holder.payoutMethods);
      await holder.save();
      if (qrId) await storage.deleteAssets([qrId]);
      await changed(req, holder);

      respondWith(res, holder);
    } catch (error) {
      next(error);
    }
  };

  return { list, add, update, setPrimary, remove };
};

// A truck owner's own accounts, which shippers pay into.
const owner = handlersFor({
  load: (req) => User.findById(req.user.userId).select('payoutMethods'),
  folder: (req) => `flito/payout/${req.user.userId}`,
});

exports.listPayoutMethods = owner.list;
exports.addPayoutMethod = owner.add;
exports.updatePayoutMethod = owner.update;
exports.setPrimaryPayoutMethod = owner.setPrimary;
exports.deletePayoutMethod = owner.remove;

// FLITO's own accounts, which owners pay FLITO's fees into. Admins manage
// them, and each change goes in the audit log.
exports.platform = handlersFor({
  load: () => PlatformSettings.current(),
  folder: () => 'flito/payout/platform',
  changed: (req, settings) => recordAdminAction(req, {
    action: 'platform.payment_details_changed',
    targetType: 'platform',
    targetId: settings._id,
    meta: { accounts: settings.payoutMethods.length },
  }),
});

exports.MAX_PAYOUT_METHODS = MAX_PAYOUT_METHODS;
