const mongoose = require('mongoose');
const User = require('../models/User');
const storage = require('../services/storage');
const { EDITABLE_KYC_STATUSES } = require('../services/kycPolicy');
const { fail } = require('../utils/respond');
const { newPin } = require('../services/pin');

// Drivers an owner adds from their fleet. Most drivers have no email, so the
// owner creates the account with just a name and phone number, and FLITO
// makes a 4-digit PIN for the driver to log in with. The owner's photo of
// the driver's license goes straight to the admin review queue: a driver is
// still only assignable to a booking once an admin approves them.

// A driver as their owner sees them. Never the PIN (only its one-time
// plaintext, when it is made) or any document identifier.
const ownerDriverView = (driver) => ({
  _id: driver._id,
  firstName: driver.firstName,
  lastName: driver.lastName,
  phone: driver.phone,
  avatarUrl: driver.avatar?.url || null,
  kycStatus: driver.kycStatus,
  kycRejectionReason: driver.kycStatus === 'rejected' ? driver.kycRejectionReason : undefined,
  hasLicense: (driver.kycDocuments || []).some((doc) => doc.type === 'driving_license'),
  createdAt: driver.createdAt,
});

const findOwnDriver = (driverId, ownerId) => (mongoose.isValidObjectId(driverId)
  ? User.findOne({ _id: driverId, role: 'driver', addedBy: ownerId })
  : null);

exports.listDrivers = async (req, res, next) => {
  try {
    const drivers = await User.find({ role: 'driver', addedBy: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, drivers: drivers.map(ownerDriverView) });
  } catch (error) {
    next(error);
  }
};

// Body is already trimmed and checked by validateAddDriver.
exports.addDriver = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const existing = await User.findOne({ phone }).select('role');
    if (existing) {
      return existing.role === 'driver'
        ? fail(res, 409, 'DRIVERS_ALREADY_REGISTERED', 'This driver already has a FLITO account. Assign them to a booking using their phone number.')
        : fail(res, 409, 'AUTH_PHONE_IN_USE', 'That phone number is already linked to another account');
    }

    const pin = newPin();
    const driver = await User.create({
      role: 'driver',
      firstName,
      lastName: lastName || undefined,
      phone,
      pin,
      addedBy: req.user.userId,
    });

    // The only time the PIN is ever shown: the owner tells it to the driver.
    res.status(201).json({ success: true, driver: ownerDriverView(driver), pin });
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, 'AUTH_PHONE_IN_USE', 'That phone number is already linked to another account');
    }
    next(error);
  }
};

// For a driver who forgot their PIN. The old one stops working at once, and
// any lock from wrong guesses is lifted.
exports.resetPin = async (req, res, next) => {
  try {
    const driver = await findOwnDriver(req.params.id, req.user.userId);
    if (!driver) return fail(res, 404, 'DRIVERS_NOT_FOUND', 'Driver not found');

    const pin = newPin();
    driver.pin = pin;
    driver.pinFailedAttempts = undefined;
    driver.pinLockedUntil = undefined;
    await driver.save();

    res.json({ success: true, pin });
  } catch (error) {
    next(error);
  }
};

// Runs before the upload is parsed, so a request that can't succeed is refused
// without buffering its file.
exports.loadDriverForLicense = async (req, res, next) => {
  try {
    if (!storage.isConfigured()) {
      return fail(res, 503, 'USERS_STORAGE_NOT_CONFIGURED', 'File uploads are not configured on this server');
    }
    const driver = await findOwnDriver(req.params.id, req.user.userId);
    if (!driver) return fail(res, 404, 'DRIVERS_NOT_FOUND', 'Driver not found');
    if (!EDITABLE_KYC_STATUSES.includes(driver.kycStatus)) {
      return fail(res, 400, 'DRIVERS_LICENSE_LOCKED', "The license can't be changed while it is being checked or once approved", { status: driver.kycStatus });
    }
    req.driver = driver;
    next();
  } catch (error) {
    next(error);
  }
};

// The license photo replaces any earlier one and sends the driver for review
// in the same step. A driver's license is a complete identity document on its
// own (see kycPolicy), and the owner who added them stands in for an address.
exports.uploadLicense = async (req, res, next) => {
  try {
    const { driver } = req;
    if (!req.file) return fail(res, 400, 'USERS_DOCUMENT_FILE_REQUIRED', 'Attach a document file');

    const stored = await storage.uploadPrivateDocument(req.file, { folder: `flito/kyc/${driver._id}` });
    const previous = driver.kycDocuments.find((doc) => doc.type === 'driving_license');

    let updated;
    try {
      updated = await User.findOneAndUpdate(
        { _id: driver._id, kycStatus: { $in: EDITABLE_KYC_STATUSES } },
        [{
          $set: {
            kycDocuments: {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ['$kycDocuments', []] },
                    as: 'doc',
                    cond: { $ne: ['$$doc.type', 'driving_license'] },
                  },
                },
                {
                  $literal: [{
                    _id: new mongoose.Types.ObjectId(),
                    type: 'driving_license',
                    publicId: stored.publicId,
                    format: stored.format,
                    bytes: stored.bytes,
                    uploadedAt: new Date(),
                  }],
                },
              ],
            },
            kycStatus: 'pending',
            kycSubmittedAt: '$$NOW',
          },
        }, {
          $unset: ['kycRejectionReason', 'kycReviewedAt', 'kycReviewedBy'],
        }],
        { new: true },
      );
    } catch (error) {
      await storage.deleteAssets([stored.publicId], { type: 'authenticated' });
      throw error;
    }

    if (!updated) {
      await storage.deleteAssets([stored.publicId], { type: 'authenticated' });
      return fail(res, 400, 'DRIVERS_LICENSE_LOCKED', "The license can't be changed while it is being checked or once approved");
    }
    if (previous) await storage.deleteAssets([previous.publicId], { type: 'authenticated' });

    res.status(201).json({ success: true, driver: ownerDriverView(updated) });
  } catch (error) {
    next(error);
  }
};

