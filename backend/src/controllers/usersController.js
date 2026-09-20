const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const storage = require('../services/storage');
const { publicUser } = require('../services/userView');
const { kycView } = require('../services/kycView');
const { isAddressComplete } = require('../services/nepalLocations');
const { issueCode } = require('../services/verification');
const { fail } = require('../utils/respond');
const { languageOf } = require('../utils/language');
const {
  EDITABLE_KYC_STATUSES,
  NAME_LOCKED_KYC_STATUSES,
  allowedDocumentsFor,
  completeDocumentSets,
  missingDocuments,
} = require('../services/kycPolicy');

const statusPhrase = (status) => (status === 'pending' ? 'under review' : status);

// Owners look up a driver by exact phone match before assigning them to a
// booking. Restricted to role=driver results and a minimal public shape.
// This is a lookup, not a general user directory.
exports.lookupDriver = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return fail(res, 400, 'USERS_PHONE_QUERY_REQUIRED', 'phone query param is required');
    }

    const driver = await User.findOne({ phone, role: 'driver' })
      .select('firstName lastName phone rating kycStatus status');

    if (!driver) {
      return fail(res, 404, 'USERS_DRIVER_NOT_FOUND', 'No driver found with that phone number');
    }

    res.json({ success: true, driver });
  } catch (error) {
    next(error);
  }
};

// Body is already whitelisted and normalized by validateProfileUpdate.
exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('+password +googleId');
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

    const { firstName, lastName, email, phone, companyName, address } = req.body;

    const nameChanging = (firstName !== undefined && firstName !== (user.firstName || ''))
      || (lastName !== undefined && lastName !== (user.lastName || ''));
    if (nameChanging && NAME_LOCKED_KYC_STATUSES.includes(user.kycStatus)) {
      return fail(
        res,
        400,
        'USERS_NAME_LOCKED',
        "Your name is checked against your KYC documents, so it can't change while they are under review or approved",
      );
    }
    if (companyName !== undefined && user.role !== 'owner') {
      return fail(res, 400, 'USERS_COMPANY_NAME_NOT_ALLOWED', 'Only truck owners have a company name');
    }
    // Email is how a password (or Google-only) account logs in; clearing it
    // with no other way in would lock the owner out of their own account.
    if (email !== undefined && !email && user.password && !user.googleId) {
      return fail(
        res,
        400,
        'USERS_EMAIL_REQUIRED_FOR_LOGIN',
        'Email is how you log in, so it cannot be removed. Add a phone number first if you want to change it.',
      );
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone || undefined;
    if (companyName !== undefined) user.companyName = companyName || undefined;
    if (address) user.address = address;

    // A changed email is a new, unverified address until proven otherwise:
    // carrying over the old `emailVerified: true` would let someone claim an
    // inbox they don't actually control.
    const emailChanging = email !== undefined && (email || undefined) !== user.email;
    if (emailChanging) {
      user.email = email || undefined;
      user.emailVerified = false;
    }

    await user.save();

    if (emailChanging && user.email) {
      try {
        // A new address gets its code straight away, whatever was sent before.
        await issueCode(user, 'verifyEmail', { ignoreCooldown: true, language: languageOf(req) });
      } catch (err) {
        console.error('[updateProfile] verification email failed:', err.message);
      }
    }

    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      return fail(res, 409, 'USERS_FIELD_IN_USE', `That ${field} is already in use`, { field });
    }
    next(error);
  }
};

// ── Push notifications ─────────────────────────────────────────────────────

// Called on login/app-open (a fresh token). Overwrites whatever was stored,
// so only the device currently signed in to this account receives its push.
exports.registerPushToken = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user.userId }, { pushToken: req.body.pushToken });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Called on logout, so a shared/reused device stops getting push for an
// account that just signed out of it.
exports.unregisterPushToken = async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user.userId }, { $unset: { pushToken: '' } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ── Notification feed ──────────────────────────────────────────────────────

exports.listNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const [items, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
      Notification.countDocuments({ userId, readAt: { $exists: false } }),
    ]);
    res.json({
      success: true,
      unreadCount,
      notifications: items.map((n) => ({
        id: n._id,
        title: n.title,
        body: n.body,
        data: n.data,
        read: !!n.readAt,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Marks the given ids read, or everything when no ids are sent.
exports.markNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const filter = { userId, readAt: { $exists: false } };
    if (Array.isArray(req.body?.ids) && req.body.ids.length) {
      filter._id = { $in: req.body.ids.filter((id) => mongoose.isValidObjectId(id)) };
    }
    await Notification.updateMany(filter, { readAt: new Date() });
    const unreadCount = await Notification.countDocuments({ userId, readAt: { $exists: false } });
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
};

// ── Profile photo ─────────────────────────────────────────────────────────

// Runs before the upload is parsed, so no file bytes are accepted when there
// is nowhere to store them.
exports.requireStorage = (req, res, next) => {
  if (!storage.isConfigured()) {
    return fail(res, 503, 'USERS_STORAGE_NOT_CONFIGURED', 'File uploads are not configured on this server');
  }
  next();
};

// With the fields publicUser needs to report hasPassword / hasGoogle.
const loadOwnUser = (userId) => User.findById(userId).select('+password +googleId');

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return fail(res, 400, 'USERS_AVATAR_FILE_REQUIRED', 'Attach an image for your profile photo');
    }

    const uploaded = await storage.uploadAvatar(req.file, { folder: `flito/avatars/${req.user.userId}` });
    // Returns the record as it was, so the photo being replaced can be deleted.
    const before = await User.findByIdAndUpdate(req.user.userId, { avatar: uploaded }, { new: false });
    if (!before) {
      await storage.deleteAssets([uploaded.publicId]);
      return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
    }
    if (before.avatar?.publicId && before.avatar.publicId !== uploaded.publicId) {
      await storage.deleteAssets([before.avatar.publicId]);
    }

    res.status(201).json({ success: true, user: publicUser(await loadOwnUser(req.user.userId)) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAvatar = async (req, res, next) => {
  try {
    const before = await User.findByIdAndUpdate(req.user.userId, { $unset: { avatar: '' } }, { new: false });
    if (!before) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

    if (before.avatar?.publicId) await storage.deleteAssets([before.avatar.publicId]);
    res.json({ success: true, user: publicUser(await loadOwnUser(req.user.userId)) });
  } catch (error) {
    next(error);
  }
};

// ── KYC ───────────────────────────────────────────────────────────────────

exports.getMyKyc = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');
    res.json({ success: true, kyc: kycView(user) });
  } catch (error) {
    next(error);
  }
};

// Runs before the upload is parsed, so a request that can't succeed is refused
// without buffering its file.
exports.loadEditableKycUser = async (req, res, next) => {
  try {
    if (!storage.isConfigured()) {
      return fail(res, 503, 'USERS_STORAGE_NOT_CONFIGURED', 'File uploads are not configured on this server');
    }

    const user = await User.findById(req.user.userId);
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

    if (!EDITABLE_KYC_STATUSES.includes(user.kycStatus)) {
      return fail(
        res,
        400,
        'USERS_KYC_NOT_EDITABLE',
        `Documents can't be changed while your verification is ${statusPhrase(user.kycStatus)}`,
        { status: user.kycStatus },
      );
    }

    req.kycUser = user;
    next();
  } catch (error) {
    next(error);
  }
};

exports.uploadKycDocument = async (req, res, next) => {
  try {
    const user = req.kycUser;
    const { type } = req.body;

    if (!allowedDocumentsFor(user).includes(type)) {
      return fail(
        res,
        400,
        'USERS_INVALID_DOCUMENT_TYPE',
        `type must be one of: ${allowedDocumentsFor(user).join(', ')}`,
        { allowedTypes: allowedDocumentsFor(user) },
      );
    }
    if (!req.file) {
      return fail(res, 400, 'USERS_DOCUMENT_FILE_REQUIRED', 'Attach a document file');
    }

    const stored = await storage.uploadPrivateDocument(req.file, { folder: `flito/kyc/${user._id}` });
    const previous = user.kycDocuments.find((doc) => doc.type === type);

    // One document per type, so a re-upload replaces the old one. A single
    // pipeline update swaps it atomically, and only while the status is still
    // editable. A document can't slip in after the user has submitted.
    let updated;
    try {
      updated = await User.findOneAndUpdate(
        { _id: user._id, kycStatus: { $in: EDITABLE_KYC_STATUSES } },
        [{
          $set: {
            kycDocuments: {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ['$kycDocuments', []] },
                    as: 'doc',
                    cond: { $ne: ['$$doc.type', { $literal: type }] },
                  },
                },
                {
                  $literal: [{
                    _id: new mongoose.Types.ObjectId(),
                    type,
                    publicId: stored.publicId,
                    format: stored.format,
                    bytes: stored.bytes,
                    uploadedAt: new Date(),
                  }],
                },
              ],
            },
          },
        }],
        { new: true },
      );
    } catch (error) {
      await storage.deleteAssets([stored.publicId], { type: 'authenticated' });
      throw error;
    }

    if (!updated) {
      await storage.deleteAssets([stored.publicId], { type: 'authenticated' });
      return fail(res, 400, 'USERS_KYC_LOCKED', 'Your documents were submitted in the meantime and can no longer be changed');
    }

    if (previous) await storage.deleteAssets([previous.publicId], { type: 'authenticated' });

    res.status(201).json({ success: true, kyc: kycView(updated) });
  } catch (error) {
    next(error);
  }
};

exports.deleteKycDocument = async (req, res, next) => {
  try {
    const user = req.kycUser;
    const doc = user.kycDocuments.id(req.params.docId);
    if (!doc) return fail(res, 404, 'USERS_DOCUMENT_NOT_FOUND', 'Document not found');

    const updated = await User.findOneAndUpdate(
      { _id: user._id, kycStatus: { $in: EDITABLE_KYC_STATUSES } },
      { $pull: { kycDocuments: { _id: doc._id } } },
      { new: true },
    );
    if (!updated) {
      return fail(res, 400, 'USERS_KYC_LOCKED', 'Your documents were submitted in the meantime and can no longer be changed');
    }

    await storage.deleteAssets([doc.publicId], { type: 'authenticated' });
    res.json({ success: true, kyc: kycView(updated) });
  } catch (error) {
    next(error);
  }
};

exports.submitKyc = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return fail(res, 404, 'USERS_NOT_FOUND', 'User not found');

    if (!EDITABLE_KYC_STATUSES.includes(user.kycStatus)) {
      return fail(
        res,
        400,
        'USERS_KYC_ALREADY_SUBMITTED',
        `Your verification is already ${statusPhrase(user.kycStatus)}`,
        { status: user.kycStatus },
      );
    }

    // Reviewers check the address alongside the documents.
    if (!isAddressComplete(user.address)) {
      return fail(res, 400, 'ADDRESS_REQUIRED', 'Add your address before submitting for verification');
    }

    const missing = missingDocuments(user);
    if (missing.length) {
      // `missingDocuments` stays a top-level field (existing tests assert on
      // it directly); `extra.documents` carries the same raw list for the
      // frontend's Nepali translation of `message`.
      return res.status(400).json({
        success: false,
        code: 'USERS_MISSING_KYC_DOCUMENTS',
        message: `Upload these documents first: ${missing.join(', ')}`,
        missingDocuments: missing,
        extra: { documents: missing },
      });
    }

    // Conditional on the documents still being complete (the role's own
    // documents plus at least one full identity document) and the status
    // unchanged, in case a document was removed during the request.
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        kycStatus: user.kycStatus,
        $or: completeDocumentSets(user).map((types) => ({ 'kycDocuments.type': { $all: types } })),
      },
      {
        $set: { kycStatus: 'pending', kycSubmittedAt: new Date() },
        $unset: { kycRejectionReason: '', kycReviewedAt: '', kycReviewedBy: '' },
      },
      { new: true },
    );
    if (!updated) {
      return fail(res, 409, 'USERS_KYC_SUBMIT_CONFLICT', 'Your documents changed while submitting. Refresh and try again.');
    }

    res.json({ success: true, kyc: kycView(updated), user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
};
