const mongoose = require('mongoose');
const User = require('../models/User');
const storage = require('../services/storage');
const { publicUser } = require('../services/userView');
const { kycView } = require('../services/kycView');
const { issueVerificationCode } = require('../services/verification');
const {
  KYC_ID_TYPES,
  DEFAULT_KYC_ID_TYPE,
  EDITABLE_KYC_STATUSES,
  NAME_LOCKED_KYC_STATUSES,
  idTypeOf,
  allowedDocumentsFor,
  requiredDocumentsFor,
  missingDocuments,
} = require('../services/kycPolicy');

const statusPhrase = (status) => (status === 'pending' ? 'under review' : status);

// Matches the identity document choice a user was loaded with, including
// accounts saved before the choice existed (no field stored, so citizenship).
const idTypeFilter = (user) => (
  idTypeOf(user) === DEFAULT_KYC_ID_TYPE ? { $in: [DEFAULT_KYC_ID_TYPE, null] } : idTypeOf(user)
);

// Owners look up a driver by exact phone match before assigning them to a
// booking. Restricted to role=driver results and a minimal public shape.
// This is a lookup, not a general user directory.
exports.lookupDriver = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'phone query param is required' });
    }

    const driver = await User.findOne({ phone, role: 'driver' })
      .select('firstName lastName phone rating kycStatus status');

    if (!driver) {
      return res.status(404).json({ success: false, message: 'No driver found with that phone number' });
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
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { firstName, lastName, email, phone, companyName, address } = req.body;

    const nameChanging = (firstName !== undefined && firstName !== (user.firstName || ''))
      || (lastName !== undefined && lastName !== (user.lastName || ''));
    if (nameChanging && NAME_LOCKED_KYC_STATUSES.includes(user.kycStatus)) {
      return res.status(400).json({
        success: false,
        message: "Your name is checked against your KYC documents, so it can't change while they are under review or approved",
      });
    }
    if (companyName !== undefined && user.role !== 'owner') {
      return res.status(400).json({ success: false, message: 'Only truck owners have a company name' });
    }
    // Email is how a password (or Google-only) account logs in; clearing it
    // with no other way in would lock the owner out of their own account.
    if (email !== undefined && !email && user.password && !user.googleId) {
      return res.status(400).json({
        success: false,
        message: 'Email is how you log in, so it cannot be removed. Add a phone number first if you want to change it.',
      });
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone || undefined;
    if (companyName !== undefined) user.companyName = companyName || undefined;
    if (address) {
      if (address.street !== undefined) user.address.street = address.street || undefined;
      if (address.city !== undefined) user.address.city = address.city || undefined;
    }

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
        await issueVerificationCode(user);
      } catch (err) {
        console.error('[updateProfile] verification email failed:', err.message);
      }
    }

    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      return res.status(409).json({ success: false, message: `That ${field} is already in use` });
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

// ── Profile photo ─────────────────────────────────────────────────────────

// Runs before the upload is parsed, so no file bytes are accepted when there
// is nowhere to store them.
exports.requireStorage = (req, res, next) => {
  if (!storage.isConfigured()) {
    return res.status(503).json({ success: false, message: 'File uploads are not configured on this server' });
  }
  next();
};

// With the fields publicUser needs to report hasPassword / hasGoogle.
const loadOwnUser = (userId) => User.findById(userId).select('+password +googleId');

exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Attach an image for your profile photo' });
    }

    const uploaded = await storage.uploadAvatar(req.file, { folder: `flito/avatars/${req.user.userId}` });
    // Returns the record as it was, so the photo being replaced can be deleted.
    const before = await User.findByIdAndUpdate(req.user.userId, { avatar: uploaded }, { new: false });
    if (!before) {
      await storage.deleteAssets([uploaded.publicId]);
      return res.status(404).json({ success: false, message: 'User not found' });
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
    if (!before) return res.status(404).json({ success: false, message: 'User not found' });

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
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
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
      return res.status(503).json({ success: false, message: 'File uploads are not configured on this server' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!EDITABLE_KYC_STATUSES.includes(user.kycStatus)) {
      return res.status(400).json({
        success: false,
        message: `Documents can't be changed while your verification is ${statusPhrase(user.kycStatus)}`,
      });
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
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${allowedDocumentsFor(user).join(', ')}`,
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Attach a document file' });
    }

    const stored = await storage.uploadPrivateDocument(req.file, { folder: `flito/kyc/${user._id}` });
    const previous = user.kycDocuments.find((doc) => doc.type === type);

    // One document per type, so a re-upload replaces the old one. A single
    // pipeline update swaps it atomically, and only while the status is still
    // editable. A document can't slip in after the user has submitted, or
    // after they switched to an identity document that doesn't use it.
    let updated;
    try {
      updated = await User.findOneAndUpdate(
        { _id: user._id, kycStatus: { $in: EDITABLE_KYC_STATUSES }, kycIdType: idTypeFilter(user) },
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
      return res.status(400).json({ success: false, message: 'Your documents were submitted in the meantime and can no longer be changed' });
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
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const updated = await User.findOneAndUpdate(
      { _id: user._id, kycStatus: { $in: EDITABLE_KYC_STATUSES } },
      { $pull: { kycDocuments: { _id: doc._id } } },
      { new: true },
    );
    if (!updated) {
      return res.status(400).json({ success: false, message: 'Your documents were submitted in the meantime and can no longer be changed' });
    }

    await storage.deleteAssets([doc.publicId], { type: 'authenticated' });
    res.json({ success: true, kyc: kycView(updated) });
  } catch (error) {
    next(error);
  }
};

// Chooses which identity document the user verifies with. Uploads the new
// choice doesn't use come off the record and out of storage, so an abandoned
// citizenship scan isn't kept after switching to a passport.
exports.setKycIdType = async (req, res, next) => {
  try {
    const { idType } = req.body || {};
    if (!KYC_ID_TYPES.includes(idType)) {
      return res.status(400).json({ success: false, message: `idType must be one of: ${KYC_ID_TYPES.join(', ')}` });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!EDITABLE_KYC_STATUSES.includes(user.kycStatus)) {
      return res.status(400).json({
        success: false,
        message: `Your identity document can't be changed while your verification is ${statusPhrase(user.kycStatus)}`,
      });
    }

    const allowed = allowedDocumentsFor(user, idType);
    // Returns the record as it was, so the files to delete are exactly the
    // documents this update removed.
    const before = await User.findOneAndUpdate(
      { _id: user._id, kycStatus: { $in: EDITABLE_KYC_STATUSES } },
      { $set: { kycIdType: idType }, $pull: { kycDocuments: { type: { $nin: allowed } } } },
      { new: false },
    );
    if (!before) {
      return res.status(400).json({ success: false, message: 'Your documents were submitted in the meantime and can no longer be changed' });
    }

    const removed = (before.kycDocuments || []).filter((doc) => !allowed.includes(doc.type));
    if (removed.length && storage.isConfigured()) {
      await storage.deleteAssets(removed.map((doc) => doc.publicId), { type: 'authenticated' });
    }

    const updated = await User.findById(user._id);
    res.json({ success: true, kyc: kycView(updated), removedDocuments: removed.map((doc) => doc.type) });
  } catch (error) {
    next(error);
  }
};

exports.submitKyc = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!EDITABLE_KYC_STATUSES.includes(user.kycStatus)) {
      return res.status(400).json({ success: false, message: `Your verification is already ${statusPhrase(user.kycStatus)}` });
    }

    const missing = missingDocuments(user);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Upload these documents first: ${missing.join(', ')}`,
        missingDocuments: missing,
      });
    }

    // Conditional on the documents still being complete and the status and
    // identity document choice unchanged, in case either changed during the
    // request.
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        kycStatus: user.kycStatus,
        kycIdType: idTypeFilter(user),
        'kycDocuments.type': { $all: requiredDocumentsFor(user) },
      },
      {
        $set: { kycStatus: 'pending', kycSubmittedAt: new Date() },
        $unset: { kycRejectionReason: '', kycReviewedAt: '', kycReviewedBy: '' },
      },
      { new: true },
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Your documents changed while submitting. Refresh and try again.' });
    }

    res.json({ success: true, kyc: kycView(updated), user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
};
