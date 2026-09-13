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

// Coordinates are optional on a load (a shipper may skip the map picker), but
// a value that IS sent must be a real point, not garbage that would silently
// break the tracking map later.
const validCoordsOrAbsent = (coordinates) => {
  if (coordinates == null) return true;
  const { lat, lng } = coordinates;
  if (lat === undefined && lng === undefined) return true;
  return isValidLat(lat) && isValidLng(lng);
};

const validateCreateLoad = (req, res, next) => {
  const { goodsType, pickupLocation, dropoffLocation } = req.body;
  if (!goodsType) {
    return res.status(400).json({ success: false, message: 'goodsType is required' });
  }
  if (!pickupLocation?.address || !dropoffLocation?.address) {
    return res.status(400).json({ success: false, message: 'pickupLocation and dropoffLocation addresses are required' });
  }
  if (!validCoordsOrAbsent(pickupLocation.coordinates) || !validCoordsOrAbsent(dropoffLocation.coordinates)) {
    return res.status(400).json({ success: false, message: 'pickup/dropoff coordinates must be valid lat/lng values' });
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PROFILE_TEXT_FIELDS = ['firstName', 'lastName', 'email', 'companyName'];

// Whitelists what a user may change about themselves. Anything else in the
// body (phone, role, kycStatus, rating) is dropped before it reaches the
// controller, which works only from the cleaned result.
const validateProfileUpdate = (req, res, next) => {
  const fail = (message) => res.status(400).json({ success: false, message });
  const body = req.body || {};
  const update = {};

  for (const key of PROFILE_TEXT_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string') return fail(`${key} must be text`);
    update[key] = body[key].trim();
  }

  if (body.address !== undefined) {
    const { street, city } = body.address || {};
    const invalid = [street, city].some((v) => v !== undefined && (typeof v !== 'string' || v.length > 100));
    if (invalid) return fail('address street and city must be text of at most 100 characters');
    update.address = { street: street?.trim(), city: city?.trim() };
  }

  if (update.firstName !== undefined && (!update.firstName || update.firstName.length > 50)) {
    return fail('firstName must be 1 to 50 characters');
  }
  if (update.lastName !== undefined && update.lastName.length > 50) {
    return fail('lastName must be at most 50 characters');
  }
  if (update.companyName !== undefined && update.companyName.length > 100) {
    return fail('companyName must be at most 100 characters');
  }
  if (update.email) {
    if (!EMAIL_REGEX.test(update.email)) return fail('Enter a valid email address');
    update.email = update.email.toLowerCase();
  }

  req.body = update;
  next();
};

const isValidLat = (v) => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
const isValidLng = (v) => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;

const validateCoordinates = (req, res, next) => {
  const { lat, lng } = req.body;
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return res.status(400).json({ success: false, message: 'lat must be -90 to 90 and lng must be -180 to 180' });
  }
  next();
};

const validatePushToken = (req, res, next) => {
  const { pushToken } = req.body;
  const { isExpoPushToken } = require('../services/push');
  if (typeof pushToken !== 'string' || !isExpoPushToken(pushToken)) {
    return res.status(400).json({ success: false, message: 'pushToken must be a valid Expo push token' });
  }
  next();
};

module.exports = {
  isValidLat,
  isValidLng,
  validateCoordinates,
  validatePushToken,
  validateProfileUpdate,
  validateRating,
  isValidPhone,
  validateSendOtp,
  validateSignup,
  validateCreateLoad,
  validateCreateQuote,
  validateCounterOffer,
  validateCreateTruck,
};
