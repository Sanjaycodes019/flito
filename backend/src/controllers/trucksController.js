const mongoose = require('mongoose');
const Truck = require('../models/Truck');
const User = require('../models/User');
const storage = require('../services/storage');
const { REQUIRED_TRUCK_DOCUMENTS, TRUCK_DOCUMENT_TYPES } = require('../config/truckTypes');
const {
  EDITABLE_TRUCK_VERIFICATION,
  EDITABLE_VERIFICATION_FILTER,
  VERIFIED_TRUCK_FIELDS,
  verificationStatusOf,
  missingTruckDocuments,
  ownerTruckView,
} = require('../services/truckView');

const DRIVER_FIELDS = 'firstName lastName phone rating kycStatus';

const statusPhrase = (status) => (status === 'pending' ? 'under review' : status);

const CHANGED_WHILE_SAVING = "This truck was submitted for verification in the meantime, so its papers can't change";

// Owners manage their own fleet; every handler is scoped to req.user. Bodies
// have already been checked and cleaned by validateCreateTruck or
// validateUpdateTruck.
exports.createTruck = async (req, res, next) => {
  try {
    const truck = await Truck.create({ ...req.body, ownerId: req.user.userId });
    res.status(201).json({ success: true, truck: ownerTruckView(truck) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already have a truck with that registration number' });
    }
    next(error);
  }
};

exports.listMyTrucks = async (req, res, next) => {
  try {
    const trucks = await Truck.find({ ownerId: req.user.userId })
      .populate('assignedDriverId', DRIVER_FIELDS)
      .sort({ createdAt: -1 });

    res.json({ success: true, trucks: trucks.map(ownerTruckView) });
  } catch (error) {
    next(error);
  }
};

const findOwnTruck = async (truckId, userId) => {
  const truck = await Truck.findById(truckId);
  if (!truck) return { error: { status: 404, message: 'Truck not found' } };
  if (String(truck.ownerId) !== userId) {
    return { error: { status: 403, message: 'Not your truck' } };
  }
  return { truck };
};

const sameValue = (a, b) => (a == null && b == null) || String(a) === String(b);

// Any of the details, rates and status. A field sent as null (already turned
// into undefined) is cleared. Changing something an admin verified takes the
// badge away until the truck is checked again.
exports.updateTruck = async (req, res, next) => {
  try {
    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const changesVerified = VERIFIED_TRUCK_FIELDS.some((field) => field in req.body && !sameValue(req.body[field], truck[field]));

    Object.entries(req.body).forEach(([field, value]) => truck.set(field, value));
    if (changesVerified && ['pending', 'approved'].includes(verificationStatusOf(truck))) {
      truck.verificationStatus = 'not_submitted';
      truck.verificationSubmittedAt = undefined;
      truck.verificationReviewedAt = undefined;
      truck.verificationReviewedBy = undefined;
      truck.verificationRejectionReason = undefined;
    }
    await truck.save();

    const populated = await truck.populate('assignedDriverId', DRIVER_FIELDS);
    res.json({ success: true, truck: ownerTruckView(populated) });
  } catch (error) {
    next(error);
  }
};

// Attach (or detach, by passing no driverPhone) this truck's regular driver.
exports.assignDriver = async (req, res, next) => {
  try {
    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const { driverPhone } = req.body;
    if (!driverPhone) {
      truck.assignedDriverId = undefined;
      await truck.save();
      return res.json({ success: true, truck: ownerTruckView(truck) });
    }

    const driver = await User.findOne({ phone: driverPhone, role: 'driver' });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'No driver found with that phone number' });
    }

    truck.assignedDriverId = driver._id;
    await truck.save();

    const populated = await truck.populate('assignedDriverId', DRIVER_FIELDS);
    res.json({ success: true, truck: ownerTruckView(populated) });
  } catch (error) {
    next(error);
  }
};

exports.deleteTruck = async (req, res, next) => {
  try {
    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await truck.deleteOne();
    await storage.deleteAssets((truck.verificationDocuments || []).map((doc) => doc.publicId), { type: 'authenticated' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ── Verification ─────────────────────────────────────────────────────────

// Runs before the upload is parsed, so a request that can't succeed is refused
// without buffering its file.
exports.loadEditableTruck = async (req, res, next) => {
  try {
    if (!storage.isConfigured()) {
      return res.status(503).json({ success: false, message: 'File uploads are not configured on this server' });
    }

    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const status = verificationStatusOf(truck);
    if (!EDITABLE_TRUCK_VERIFICATION.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Papers can't be changed while this truck's verification is ${statusPhrase(status)}`,
      });
    }

    req.truck = truck;
    next();
  } catch (error) {
    next(error);
  }
};

exports.uploadTruckDocument = async (req, res, next) => {
  try {
    const { truck } = req;
    const { type } = req.body;

    if (!TRUCK_DOCUMENT_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${TRUCK_DOCUMENT_TYPES.join(', ')}` });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Attach a photo or PDF of the paper' });
    }

    const stored = await storage.uploadPrivateDocument(req.file, { folder: `flito/trucks/${truck._id}` });
    const previous = (truck.verificationDocuments || []).find((doc) => doc.type === type);

    // One paper per type, so a re-upload replaces the old one, atomically and
    // only while the truck is still editable.
    let updated;
    try {
      updated = await Truck.findOneAndUpdate(
        { _id: truck._id, ...EDITABLE_VERIFICATION_FILTER },
        [{
          $set: {
            verificationDocuments: {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ['$verificationDocuments', []] },
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
      return res.status(400).json({ success: false, message: CHANGED_WHILE_SAVING });
    }

    if (previous) await storage.deleteAssets([previous.publicId], { type: 'authenticated' });

    const populated = await updated.populate('assignedDriverId', DRIVER_FIELDS);
    res.status(201).json({ success: true, truck: ownerTruckView(populated) });
  } catch (error) {
    next(error);
  }
};

exports.deleteTruckDocument = async (req, res, next) => {
  try {
    const { truck } = req;
    const doc = truck.verificationDocuments.id(req.params.docId);
    if (!doc) return res.status(404).json({ success: false, message: 'Paper not found' });

    const updated = await Truck.findOneAndUpdate(
      { _id: truck._id, ...EDITABLE_VERIFICATION_FILTER },
      { $pull: { verificationDocuments: { _id: doc._id } } },
      { new: true },
    );
    if (!updated) return res.status(400).json({ success: false, message: CHANGED_WHILE_SAVING });

    await storage.deleteAssets([doc.publicId], { type: 'authenticated' });
    const populated = await updated.populate('assignedDriverId', DRIVER_FIELDS);
    res.json({ success: true, truck: ownerTruckView(populated) });
  } catch (error) {
    next(error);
  }
};

// Sends the truck and its papers to an admin for review.
exports.submitTruckVerification = async (req, res, next) => {
  try {
    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const status = verificationStatusOf(truck);
    if (!EDITABLE_TRUCK_VERIFICATION.includes(status)) {
      return res.status(400).json({ success: false, message: `This truck's verification is already ${statusPhrase(status)}` });
    }

    const missing = missingTruckDocuments(truck);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Upload these papers first: ${missing.join(', ')}`,
        missingDocuments: missing,
      });
    }

    // Conditional on the required papers still being there, in case one was
    // removed during the request.
    const updated = await Truck.findOneAndUpdate(
      { _id: truck._id, ...EDITABLE_VERIFICATION_FILTER, 'verificationDocuments.type': { $all: REQUIRED_TRUCK_DOCUMENTS } },
      {
        $set: { verificationStatus: 'pending', verificationSubmittedAt: new Date() },
        $unset: { verificationRejectionReason: '', verificationReviewedAt: '', verificationReviewedBy: '' },
      },
      { new: true },
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: "This truck's papers changed while submitting. Refresh and try again." });
    }

    const populated = await updated.populate('assignedDriverId', DRIVER_FIELDS);
    res.json({ success: true, truck: ownerTruckView(populated) });
  } catch (error) {
    next(error);
  }
};
