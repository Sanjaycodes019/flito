const Truck = require('../models/Truck');
const User = require('../models/User');

const DRIVER_FIELDS = 'firstName lastName phone rating kycStatus';

// Owners manage their own fleet; every handler is scoped to req.user. The
// body has already been checked and cleaned by validateCreateTruck or
// validateUpdateTruck.
exports.createTruck = async (req, res, next) => {
  try {
    const truck = await Truck.create({ ...req.body, ownerId: req.user.userId });
    res.status(201).json({ success: true, truck });
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

    res.json({ success: true, trucks });
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

// Any of type, capacity, make and model, year, base, rates and status. A
// field sent as null (already turned into undefined) is cleared.
exports.updateTruck = async (req, res, next) => {
  try {
    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    Object.entries(req.body).forEach(([field, value]) => truck.set(field, value));
    await truck.save();

    const populated = await truck.populate('assignedDriverId', DRIVER_FIELDS);
    res.json({ success: true, truck: populated });
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
      return res.json({ success: true, truck });
    }

    const driver = await User.findOne({ phone: driverPhone, role: 'driver' });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'No driver found with that phone number' });
    }

    truck.assignedDriverId = driver._id;
    await truck.save();

    const populated = await truck.populate('assignedDriverId', DRIVER_FIELDS);
    res.json({ success: true, truck: populated });
  } catch (error) {
    next(error);
  }
};

exports.deleteTruck = async (req, res, next) => {
  try {
    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await truck.deleteOne();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
