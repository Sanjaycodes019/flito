const Load = require('../models/Load');
const Quote = require('../models/Quote');
const storage = require('../services/storage');
const {
  LOAD_TTL_MS,
  BIDDABLE_LOAD_STATUSES,
  OPEN_QUOTE_STATUSES,
  isExpired,
} = require('../services/expiry');

const MAX_LOAD_PHOTOS = 6;

// Photos describe the cargo owners are bidding on, so they can change only
// while the load is on the market. Once booked they are part of the agreed job.
const PHOTO_EDITABLE_STATUSES = [...BIDDABLE_LOAD_STATUSES, 'expired'];

// Create a load posting (Shipper only). Photos are not accepted here: they are
// uploaded to the saved load, so a client can never attach an arbitrary URL.
exports.createLoad = async (req, res, next) => {
  try {
    const {
      goodsType, description, weight, volume, quantity,
      pickupLocation, dropoffLocation, preferredPickupDate,
      estimatedDeliveryDate, truckTypePreference, budgetEstimate,
    } = req.body;

    const load = await Load.create({
      shipperId: req.user.userId,
      goodsType,
      description,
      weight,
      volume,
      quantity,
      pickupLocation,
      dropoffLocation,
      preferredPickupDate,
      estimatedDeliveryDate,
      truckTypePreference,
      budgetEstimate,
      expiresAt: new Date(Date.now() + LOAD_TTL_MS),
    });

    res.status(201).json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// A shipper sees all of their own loads. Everyone else browses loads that are
// still taking bids — including ones that already have quotes, so several
// owners can compete — minus any whose window has closed.
exports.listLoads = async (req, res, next) => {
  try {
    const { mine, status } = req.query;
    const filter = {};

    if (mine === 'true') {
      filter.shipperId = req.user.userId;
    } else if (status) {
      filter.status = status;
    } else {
      filter.status = { $in: BIDDABLE_LOAD_STATUSES };
      filter.$or = [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }];
    }

    const loads = await Load.find(filter)
      .populate('shipperId', 'firstName lastName rating companyName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, loads });
  } catch (error) {
    next(error);
  }
};

exports.getLoad = async (req, res, next) => {
  try {
    const load = await Load.findById(req.params.id).populate('shipperId', 'firstName lastName rating companyName');
    if (!load) return res.status(404).json({ success: false, message: 'Load not found' });
    res.json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

const findOwnLoad = async (req, res) => {
  const load = await Load.findById(req.params.id);
  if (!load) {
    res.status(404).json({ success: false, message: 'Load not found' });
    return null;
  }
  if (String(load.shipperId) !== req.user.userId) {
    res.status(403).json({ success: false, message: 'Not your load' });
    return null;
  }
  return load;
};

// Shipper withdraws their own load before it is booked. Live bids on it are
// closed out so owners aren't left negotiating on a load that no longer exists.
exports.cancelLoad = async (req, res, next) => {
  try {
    const load = await findOwnLoad(req, res);
    if (!load) return;

    if (![...BIDDABLE_LOAD_STATUSES, 'expired'].includes(load.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel a load that is ${load.status}` });
    }

    load.status = 'cancelled';
    await load.save();
    await Quote.updateMany({ loadId: load._id, status: { $in: OPEN_QUOTE_STATUSES } }, { status: 'rejected' });

    res.json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// Put an expired load back on the market with a fresh window. Bids made on the
// old posting stay expired; owners bid again against the relisted load.
exports.relistLoad = async (req, res, next) => {
  try {
    const load = await findOwnLoad(req, res);
    if (!load) return;

    // The sweep may not have run yet, so a biddable load past its window
    // counts as expired too.
    const lapsed = load.status === 'expired'
      || (BIDDABLE_LOAD_STATUSES.includes(load.status) && isExpired(load));
    if (!lapsed) {
      return res.status(400).json({ success: false, message: `Only an expired load can be relisted (this one is ${load.status})` });
    }

    await Quote.updateMany({ loadId: load._id, status: { $in: OPEN_QUOTE_STATUSES } }, { status: 'expired' });

    load.status = 'open';
    load.totalQuotes = 0;
    load.expiresAt = new Date(Date.now() + LOAD_TTL_MS);
    await load.save();

    res.json({ success: true, load });
  } catch (error) {
    next(error);
  }
};

// All quotes submitted for one load (shipper reviewing bids)
exports.listQuotesForLoad = async (req, res, next) => {
  try {
    const load = await findOwnLoad(req, res);
    if (!load) return;

    const quotes = await Quote.find({ loadId: load._id })
      .populate('ownerId', 'firstName lastName companyName rating')
      .sort({ createdAt: -1 });

    res.json({ success: true, quotes });
  } catch (error) {
    next(error);
  }
};

// Runs before the upload is parsed, so a request that can't succeed is refused
// without buffering its files.
exports.loadEditableOwnLoad = async (req, res, next) => {
  try {
    if (!storage.isConfigured()) {
      return res.status(503).json({ success: false, message: 'File uploads are not configured on this server' });
    }

    const load = await findOwnLoad(req, res);
    if (!load) return;

    if (!PHOTO_EDITABLE_STATUSES.includes(load.status)) {
      return res.status(400).json({ success: false, message: `Photos can't be changed once a load is ${load.status}` });
    }

    req.load = load;
    next();
  } catch (error) {
    next(error);
  }
};

exports.addLoadPhotos = async (req, res, next) => {
  try {
    const { load } = req;
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Attach at least one photo' });
    }
    if (load.photos.length + files.length > MAX_LOAD_PHOTOS) {
      return res.status(400).json({
        success: false,
        message: `A load can have at most ${MAX_LOAD_PHOTOS} photos (it has ${load.photos.length})`,
      });
    }

    const uploaded = await storage.uploadImages(files, { folder: `flito/loads/${load._id}` });

    // Re-checked atomically, so two uploads landing together can't exceed the
    // limit or add photos to a load that was just booked.
    let updated;
    try {
      updated = await Load.findOneAndUpdate(
        {
          _id: load._id,
          status: { $in: PHOTO_EDITABLE_STATUSES },
          $expr: { $lte: [{ $add: [{ $size: { $ifNull: ['$photos', []] } }, uploaded.length] }, MAX_LOAD_PHOTOS] },
        },
        { $push: { photos: { $each: uploaded } } },
        { new: true },
      );
    } catch (error) {
      await storage.deleteAssets(uploaded.map((photo) => photo.publicId));
      throw error;
    }

    if (!updated) {
      await storage.deleteAssets(uploaded.map((photo) => photo.publicId));
      return res.status(409).json({ success: false, message: 'This load changed while uploading — refresh and try again' });
    }

    res.status(201).json({ success: true, load: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteLoadPhoto = async (req, res, next) => {
  try {
    const { load } = req;
    const photo = load.photos.id(req.params.photoId);
    if (!photo) return res.status(404).json({ success: false, message: 'Photo not found' });

    const updated = await Load.findOneAndUpdate(
      { _id: load._id, status: { $in: PHOTO_EDITABLE_STATUSES } },
      { $pull: { photos: { _id: photo._id } } },
      { new: true },
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'This load was booked in the meantime, so its photos are locked' });
    }

    await storage.deleteAssets([photo.publicId]);
    res.json({ success: true, load: updated });
  } catch (error) {
    next(error);
  }
};

exports.MAX_LOAD_PHOTOS = MAX_LOAD_PHOTOS;
