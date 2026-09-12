const Truck = require('../models/Truck');
const User = require('../models/User');

// Owners manage their own fleet; every handler is scoped to req.user.
exports.createTruck = async (req, res, next) => {
  try {
    const { registrationNumber, truckType, capacity, makeModel, year } = req.body;

    const truck = await Truck.create({
      ownerId: req.user.userId,
      registrationNumber,
      truckType,
      capacity,
      makeModel,
      year,
    });

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
      .populate('assignedDriverId', 'firstName lastName phone rating')
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

exports.updateTruck = async (req, res, next) => {
  try {
    const { truck, error } = await findOwnTruck(req.params.id, req.user.userId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const { truckType, capacity, makeModel, year, status } = req.body;
    if (truckType) truck.truckType = truckType;
    if (capacity !== undefined) truck.capacity = capacity;
    if (makeModel !== undefined) truck.makeModel = makeModel;
    if (year !== undefined) truck.year = year;
    if (status) {
      if (!['active', 'maintenance', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid truck status' });
      }
      truck.status = status;
    }

    await truck.save();
    res.json({ success: true, truck });
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

    const populated = await truck.populate('assignedDriverId', 'firstName lastName phone rating');
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
