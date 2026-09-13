const PHONE_REGEX = /^\+977\d{10}$/;

const isValidPhone = (phone) => typeof phone === 'string' && PHONE_REGEX.test(phone);

// Validate signup/OTP payloads
const validateSendOtp = (req, res, next) => {
  const { phone } = req.body;
  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, message: 'Valid +977 phone number is required' });
  }
  next();
};

const validateSignup = (req, res, next) => {
  const { phone, otp, role, firstName } = req.body;
  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, message: 'Valid +977 phone number is required' });
  }
  if (!otp) {
    return res.status(400).json({ success: false, message: 'OTP is required' });
  }
  if (!['shipper', 'owner', 'driver'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Role must be shipper, owner, or driver' });
  }
  if (!firstName) {
    return res.status(400).json({ success: false, message: 'First name is required' });
  }
  next();
};

const validateCreateLoad = (req, res, next) => {
  const { goodsType, pickupLocation, dropoffLocation } = req.body;
  if (!goodsType) {
    return res.status(400).json({ success: false, message: 'goodsType is required' });
  }
  if (!pickupLocation?.address || !dropoffLocation?.address) {
    return res.status(400).json({ success: false, message: 'pickupLocation and dropoffLocation addresses are required' });
  }
  next();
};

const validateCreateQuote = (req, res, next) => {
  const { loadId, quotedPrice } = req.body;
  if (!loadId) {
    return res.status(400).json({ success: false, message: 'loadId is required' });
  }
  if (typeof quotedPrice !== 'number' || quotedPrice <= 0) {
    return res.status(400).json({ success: false, message: 'quotedPrice must be a positive number' });
  }
  next();
};

const validateCounterOffer = (req, res, next) => {
  const { counterOfferPrice } = req.body;
  if (typeof counterOfferPrice !== 'number' || counterOfferPrice <= 0) {
    return res.status(400).json({ success: false, message: 'counterOfferPrice must be a positive number' });
  }
  next();
};

const validateCreateTruck = (req, res, next) => {
  const { registrationNumber, truckType } = req.body;
  if (!registrationNumber || !String(registrationNumber).trim()) {
    return res.status(400).json({ success: false, message: 'registrationNumber is required' });
  }
  if (!truckType) {
    return res.status(400).json({ success: false, message: 'truckType is required' });
  }
  next();
};

const validateRating = (req, res, next) => {
  const { rating, review } = req.body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'rating must be a whole number from 1 to 5' });
  }
  if (review !== undefined && (typeof review !== 'string' || review.length > 1000)) {
    return res.status(400).json({ success: false, message: 'review must be text of at most 1000 characters' });
  }
  next();
};

module.exports = {
  validateRating,
  isValidPhone,
  validateSendOtp,
  validateSignup,
  validateCreateLoad,
  validateCreateQuote,
  validateCounterOffer,
  validateCreateTruck,
};
