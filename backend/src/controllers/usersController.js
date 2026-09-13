const mongoose = require('mongoose');
const User = require('../models/User');
const storage = require('../services/storage');
const { publicUser } = require('../services/userView');
const { kycView } = require('../services/kycView');
const {
  EDITABLE_KYC_STATUSES,
  NAME_LOCKED_KYC_STATUSES,
  allowedDocumentsFor,
  requiredDocumentsFor,
  missingDocuments,
} = require('../services/kycPolicy');

const statusPhrase = (status) => (status === 'pending' ? 'under review' : status);

// Owners look up a driver by exact phone match before assigning them to a
// booking. Restricted to role=driver results and a minimal public shape —
// this is a lookup, not a general user directory.
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
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { firstName, lastName, email, companyName, address } = req.body;

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

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    // An empty value clears the field; for email that also frees the unique slot.
    if (email !== undefined) user.email = email || undefined;
    if (companyName !== undefined) user.companyName = companyName || undefined;
    if (address) {
      if (address.street !== undefined) user.address.street = address.street || undefined;
      if (address.city !== undefined) user.address.city = address.city || undefined;
    }

    await user.save();
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000 && error.keyValue?.email) {
      return res.status(409).json({ success: false, message: 'That email is already used by another account' });
    }
    next(error);
  }
};

// ── Push notifications ─────────────────────────────────────────────────────

// Called on login/app-open (a fresh token) — overwrites whatever was stored,
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

    if (!allowedDocumentsFor(user.role).includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${allowedDocumentsFor(user.role).join(', ')}`,
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Attach a document file' });
    }

    const stored = await storage.uploadPrivateDocument(req.file, { folder: `flito/kyc/${user._id}` });
    const previous = user.kycDocuments.find((doc) => doc.type === type);

    // One document per type, so a re-upload replaces the old one. A single
    // pipeline update swaps it atomically, and only while the status is still
    // editable — a document can't slip in after the user has submitted.
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

    // Conditional on the documents still being complete and the status
    // unchanged, in case a document was removed during the request.
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        kycStatus: user.kycStatus,
        'kycDocuments.type': { $all: requiredDocumentsFor(user.role) },
      },
      {
        $set: { kycStatus: 'pending', kycSubmittedAt: new Date() },
        $unset: { kycRejectionReason: '', kycReviewedAt: '', kycReviewedBy: '' },
      },
      { new: true },
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Your documents changed while submitting — refresh and try again' });
    }

    res.json({ success: true, kyc: kycView(updated), user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
};
