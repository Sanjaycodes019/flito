const { validateAddress, validateArea, describeAddress } = require('../services/nepalLocations');
const { nepalDay, addDays, isDayKey } = require('../services/nepalTime');
const {
  TRUCK_TYPES, ALL_TRUCK_TYPES, BODY_TYPES, FUEL_TYPES, TRUCK_MAKES, SERVICE_AREAS, INSURANCE_TYPES, TRUCK_FEATURES,
} = require('../config/truckTypes');
const { fail: respond } = require('../utils/respond');

const PHONE_REGEX = /^\+977\d{10}$/;
const EMAIL_AUTH_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isValidPhone = (phone) => typeof phone === 'string' && PHONE_REGEX.test(phone);
const isValidEmail = (email) => typeof email === 'string' && EMAIL_AUTH_REGEX.test(email);

// Length over composition rules (current NIST guidance): 8+ characters,
// at least one letter and one digit so it isn't purely numeric, nothing
// more exotic required. The frontend's strength meter grades beyond this
// minimum; this is only the floor the server actually enforces.
const isValidPassword = (password) =>
  typeof password === 'string'
  && password.length >= 8
  && /[A-Za-z]/.test(password)
  && /\d/.test(password);

const validateEmailSignup = (req, res, next) => {
  const { email, password, role, firstName, phone } = req.body;
  if (!isValidEmail(email)) {
    return respond(res, 400, 'VALIDATION_INVALID_EMAIL', 'Enter a valid email address');
  }
  if (!isValidPassword(password)) {
    return respond(res, 400, 'VALIDATION_WEAK_PASSWORD', 'Password must be at least 8 characters and include a letter and a number');
  }
  if (!['shipper', 'owner', 'driver'].includes(role)) {
    return respond(res, 400, 'VALIDATION_INVALID_ROLE', 'Role must be shipper, owner, or driver');
  }
  if (!firstName || !String(firstName).trim()) {
    return respond(res, 400, 'VALIDATION_FIRST_NAME_REQUIRED', 'First name is required');
  }
  // Phone is optional, but a value that IS sent must be a real +977 number,
  // not silently-accepted garbage that breaks later (driver lookup, SMS).
  if (phone !== undefined && phone !== '' && phone !== null && !isValidPhone(phone)) {
    return respond(res, 400, 'VALIDATION_INVALID_PHONE', 'Phone number must be a valid +977 number, or left blank');
  }
  next();
};

const validateEmailLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!isValidEmail(email) || !password) {
    return respond(res, 400, 'VALIDATION_LOGIN_REQUIRED', 'Email and password are required');
  }
  next();
};

const validateAdminLogin = (req, res, next) => {
  const { email, password, accessKey } = req.body;
  if (!isValidEmail(email) || !password || !accessKey) {
    return respond(res, 400, 'VALIDATION_ADMIN_LOGIN_REQUIRED', 'Email, password and access key are required');
  }
  next();
};

const validateAdminSignup = (req, res, next) => {
  const { email, password, firstName, accessKey } = req.body;
  if (!isValidEmail(email) || !firstName || !String(firstName).trim() || !accessKey) {
    return respond(res, 400, 'VALIDATION_ADMIN_SIGNUP_REQUIRED', 'Name, email and access key are required');
  }
  if (!isValidPassword(password)) {
    return respond(res, 400, 'VALIDATION_WEAK_PASSWORD', 'Password must be at least 8 characters and include a letter and a number');
  }
  next();
};

const validateGoogleAuth = (req, res, next) => {
  const { idToken, role } = req.body;
  if (!idToken || typeof idToken !== 'string') {
    return respond(res, 400, 'VALIDATION_GOOGLE_TOKEN_REQUIRED', 'Google idToken is required');
  }
  // Only required for a first-time signup; the controller ignores it for an
  // account that already exists.
  if (role !== undefined && !['shipper', 'owner', 'driver'].includes(role)) {
    return respond(res, 400, 'VALIDATION_INVALID_ROLE', 'Role must be shipper, owner, or driver');
  }
  next();
};

const validateForgotPassword = (req, res, next) => {
  if (!isValidEmail(req.body.email)) {
    return respond(res, 400, 'VALIDATION_INVALID_EMAIL', 'Enter a valid email address');
  }
  next();
};

const validateResetPassword = (req, res, next) => {
  const { email, code, newPassword } = req.body;
  if (!isValidEmail(email) || !code) {
    return respond(res, 400, 'VALIDATION_CODE_REQUIRED', 'Email and code are required');
  }
  if (!isValidPassword(newPassword)) {
    return respond(res, 400, 'VALIDATION_WEAK_PASSWORD', 'Password must be at least 8 characters and include a letter and a number');
  }
  next();
};

const validateVerifyEmail = (req, res, next) => {
  const { email, code } = req.body;
  if (!isValidEmail(email) || !code) {
    return respond(res, 400, 'VALIDATION_CODE_REQUIRED', 'Email and code are required');
  }
  next();
};

const CONTACT_NAME_MAX_LENGTH = 60;

// A pickup or dropoff is a complete Nepal address from the official lists,
// checked the same way as a profile address. Its display text is built here
// from those lists, never taken from the client. The exact point on a map
// (coordinates) and the contact are optional. Returns { stop } or { error }.
const cleanStop = (input, name) => {
  const { address, error } = validateAddress(input);
  if (error) return { error: `${name}: ${error}`, code: 'VALIDATION_STOP_ADDRESS', extra: { stop: name, detail: error } };

  const { formatted, label } = describeAddress(address);
  const stop = { ...address, address: formatted, label };

  const { contactPerson, phone } = input;
  if (contactPerson !== undefined && contactPerson !== null && contactPerson !== '') {
    if (typeof contactPerson !== 'string' || contactPerson.trim().length > CONTACT_NAME_MAX_LENGTH) {
      return {
        error: `${name}: contact name must be text of at most ${CONTACT_NAME_MAX_LENGTH} characters`,
        code: 'VALIDATION_CONTACT_NAME',
        extra: { stop: name, max: CONTACT_NAME_MAX_LENGTH },
      };
    }
    if (contactPerson.trim()) stop.contactPerson = contactPerson.trim();
  }
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!isValidPhone(phone)) {
      return {
        error: `${name}: contact phone must be a valid +977 number, or left blank`,
        code: 'VALIDATION_CONTACT_PHONE',
        extra: { stop: name },
      };
    }
    stop.phone = phone;
  }

  return { stop };
};

// Matching trucks needs the weight, so it's required. The heaviest rigs on
// Nepal's roads carry about this much.
const MAX_LOAD_WEIGHT_KG = 60000;
const MAX_PICKUP_DAYS_AHEAD = 14;

// A pickup date from today to MAX_PICKUP_DAYS_AHEAD out, as a Nepal day key.
// Returns { day } or { error }.
const pickupDayFrom = (value) => {
  const today = nepalDay();
  if (!isDayKey(value) || value < today || value > addDays(today, MAX_PICKUP_DAYS_AHEAD)) {
    return {
      error: `pickupDate must be a date (YYYY-MM-DD) from today to ${MAX_PICKUP_DAYS_AHEAD} days ahead`,
      code: 'VALIDATION_PICKUP_DATE',
      extra: { maxDaysAhead: MAX_PICKUP_DAYS_AHEAD },
    };
  }
  return { day: value };
};

const validateCreateLoad = (req, res, next) => {
  const fail = (message, code, extra) => respond(res, 400, code, message, extra);
  const { goodsType, weight, pickupDate, pickupLocation, dropoffLocation } = req.body;

  if (typeof goodsType !== 'string' || !goodsType.trim() || goodsType.trim().length > 100) {
    return fail('goodsType is required (up to 100 characters)', 'VALIDATION_LOAD_GOODS_TYPE');
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0 || weight > MAX_LOAD_WEIGHT_KG) {
    return fail(`weight is required, in kg, up to ${MAX_LOAD_WEIGHT_KG.toLocaleString('en-IN')}`, 'VALIDATION_LOAD_WEIGHT', { max: MAX_LOAD_WEIGHT_KG });
  }

  // Today when not given.
  const pickup = pickupDate === undefined ? { day: nepalDay() } : pickupDayFrom(pickupDate);
  if (pickup.error) return fail(pickup.error, pickup.code, pickup.extra);

  const pickupStop = cleanStop(pickupLocation, 'Pickup');
  if (pickupStop.error) return fail(pickupStop.error, pickupStop.code, pickupStop.extra);
  const dropoffStop = cleanStop(dropoffLocation, 'Dropoff');
  if (dropoffStop.error) return fail(dropoffStop.error, dropoffStop.code, dropoffStop.extra);

  req.body.goodsType = goodsType.trim();
  req.body.pickupDay = pickup.day;
  req.body.pickupLocation = pickupStop.stop;
  req.body.dropoffLocation = dropoffStop.stop;
  next();
};

// Relisting can move the pickup date; without one the server picks today or
// the load's own date, whichever is later.
const validateRelist = (req, res, next) => {
  req.body = req.body || {};
  if (req.body.pickupDate !== undefined) {
    const pickup = pickupDayFrom(req.body.pickupDate);
    if (pickup.error) return respond(res, 400, pickup.code, pickup.error, pickup.extra);
    req.body.pickupDay = pickup.day;
  }
  next();
};

// Offers are whole rupees within sensible bounds.
const MIN_PRICE = 100;
const MAX_PRICE = 10000000;
const PRICE_RULE = `a whole number of rupees from Rs. ${MIN_PRICE} to Rs. ${MAX_PRICE.toLocaleString('en-IN')}`;
const isValidPrice = (value) => Number.isInteger(value) && value >= MIN_PRICE && value <= MAX_PRICE;

const validateCreateQuote = (req, res, next) => {
  const fail = (message, code, extra) => respond(res, 400, code, message, extra);
  const { loadId, quotedPrice, truckId } = req.body;
  if (!loadId) return fail('loadId is required', 'VALIDATION_LOAD_ID_REQUIRED');
  if (!isValidPrice(quotedPrice)) return fail(`quotedPrice must be ${PRICE_RULE}`, 'VALIDATION_PRICE', { field: 'quotedPrice', min: MIN_PRICE, max: MAX_PRICE });
  if (!truckId) return fail('truckId is required: choose which of your trucks will carry this load', 'VALIDATION_QUOTE_TRUCK_REQUIRED');
  next();
};

const validateCounterOffer = (req, res, next) => {
  if (!isValidPrice(req.body.counterOfferPrice)) {
    return respond(res, 400, 'VALIDATION_PRICE', `counterOfferPrice must be ${PRICE_RULE}`, { field: 'counterOfferPrice', min: MIN_PRICE, max: MAX_PRICE });
  }
  next();
};

// A shipper asking a particular truck to carry their load, at a price.
const validateTruckRequest = (req, res, next) => {
  const fail = (message, code, extra) => respond(res, 400, code, message, extra);
  if (!req.body.truckId) return fail('truckId is required', 'VALIDATION_TRUCK_ID_REQUIRED');
  if (!isValidPrice(req.body.price)) return fail(`price must be ${PRICE_RULE}`, 'VALIDATION_PRICE', { field: 'price', min: MIN_PRICE, max: MAX_PRICE });
  next();
};

const MAX_TRUCK_CAPACITY_KG = 60000;
const MAX_CARGO_BED_FT = 60;
const TRUCK_STATUSES = ['active', 'maintenance', 'inactive'];
// Chassis and engine numbers: letters, digits, and the odd dash or slash.
const DOCUMENT_NUMBER = /^[A-Z0-9][A-Z0-9 /-]{2,29}$/;

// Left out, null or empty: an optional value that isn't there.
const isBlank = (value) => value === undefined || value === null || value === '';

// Readers for one optional value each. They return { value } (undefined when
// blank, which clears the field) or { error } finishing "<field> ...".
const readText = (value, { maxLength, pattern, uppercase = false }) => {
  if (isBlank(value)) return { value: undefined };
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    return { error: `must be text of at most ${maxLength} characters` };
  }
  const text = uppercase ? value.trim().toUpperCase() : value.trim();
  if (pattern && !pattern.test(text)) return { error: 'can only use letters, digits, spaces, dashes and slashes' };
  return { value: text };
};

const readNumber = (value, { min, max, integer = false, label }) => {
  if (isBlank(value)) return { value: undefined };
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    return { error: `must be ${label}` };
  }
  return { value };
};

const readDate = (value) => {
  if (isBlank(value)) return { value: undefined };
  if (!isDayKey(value)) return { error: 'must be a date written YYYY-MM-DD' };
  return { value: new Date(`${value}T00:00:00Z`) };
};

const readChoice = (value, allowed) => {
  if (isBlank(value)) return { value: undefined };
  if (!allowed.includes(value)) return { error: `must be one of: ${allowed.join(', ')}` };
  return { value };
};

// A truck's details from the owner. On create the registration, class, body
// and capacity are required; on update every field is optional, and null
// clears an optional one. Returns { truck } or { error }.
const cleanTruck = (body, { creating }) => {
  const truck = {};
  const given = (field) => body[field] !== undefined;

  // Applies a reader's result to `truck`, or returns its error.
  const apply = (field, result, name = field) => {
    if (result.error) return `${name} ${result.error}`;
    truck[field] = result.value;
    return null;
  };

  if (creating) {
    if (!body.registrationNumber || !String(body.registrationNumber).trim()) return { error: 'registrationNumber is required' };
    truck.registrationNumber = String(body.registrationNumber).trim().replace(/\s+/g, ' ');
    if (!body.truckType) return { error: 'truckType is required' };
    if (!body.bodyType) return { error: 'bodyType is required' };
  }

  // A truck already listed under an older class can keep it when edited.
  if (given('truckType')) {
    const allowed = creating ? TRUCK_TYPES : ALL_TRUCK_TYPES;
    if (!allowed.includes(body.truckType)) return { error: `truckType must be one of: ${TRUCK_TYPES.join(', ')}` };
    truck.truckType = body.truckType;
  }

  if (given('bodyType')) {
    if (!BODY_TYPES.includes(body.bodyType)) return { error: `bodyType must be one of: ${BODY_TYPES.join(', ')}` };
    truck.bodyType = body.bodyType;
  }

  if (creating || given('capacity')) {
    if (!Number.isInteger(body.capacity) || body.capacity < 100 || body.capacity > MAX_TRUCK_CAPACITY_KG) {
      return { error: `capacity must be the most the truck carries, in whole kg from 100 to ${MAX_TRUCK_CAPACITY_KG.toLocaleString('en-IN')}` };
    }
    truck.capacity = body.capacity;
  }

  const latestYear = new Date().getFullYear() + 1;
  const error = (given('make') && apply('make', readChoice(body.make, TRUCK_MAKES)))
    || (given('model') && apply('model', readText(body.model, { maxLength: 40 })))
    || (given('makeModel') && !given('make') && !given('model') && apply('makeModel', readText(body.makeModel, { maxLength: 60 })))
    || (given('year') && apply('year', readNumber(body.year, { min: 1970, max: latestYear, integer: true, label: `a year from 1970 to ${latestYear}` })))
    || (given('fuelType') && apply('fuelType', readChoice(body.fuelType, FUEL_TYPES)))
    || (given('serviceArea') && apply('serviceArea', readChoice(body.serviceArea, SERVICE_AREAS)))
    || (given('ratePerKm') && apply('ratePerKm', readNumber(body.ratePerKm, { min: 0.01, max: 1000, label: 'rupees per km, above 0 and up to 1,000' })))
    || (given('minimumCharge') && apply('minimumCharge', readNumber(body.minimumCharge, { min: 0, max: 1000000, integer: true, label: 'whole rupees from 0 to 10,00,000' })))
    || (given('chassisNumber') && apply('chassisNumber', readText(body.chassisNumber, { maxLength: 30, pattern: DOCUMENT_NUMBER, uppercase: true })))
    || (given('engineNumber') && apply('engineNumber', readText(body.engineNumber, { maxLength: 30, pattern: DOCUMENT_NUMBER, uppercase: true })))
    || (given('bluebookRenewedUntil') && apply('bluebookRenewedUntil', readDate(body.bluebookRenewedUntil)))
    || (given('emissionTestValidUntil') && apply('emissionTestValidUntil', readDate(body.emissionTestValidUntil)));
  if (error) return { error };

  // Make and model are sent together; the display name follows them.
  if (given('make') || given('model')) {
    truck.makeModel = [truck.make && truck.make !== 'Other' ? truck.make : null, truck.model].filter(Boolean).join(' ') || undefined;
  }
  if (truck.serviceArea === undefined && given('serviceArea')) truck.serviceArea = 'nepal';

  if (given('cargoBed')) {
    if (isBlank(body.cargoBed)) {
      truck.cargoBed = undefined;
    } else if (typeof body.cargoBed !== 'object') {
      return { error: 'cargoBed must give lengthFt, widthFt and heightFt' };
    } else {
      const bed = {};
      for (const side of ['lengthFt', 'widthFt', 'heightFt']) {
        const result = readNumber(body.cargoBed[side], { min: 1, max: MAX_CARGO_BED_FT, label: `feet from 1 to ${MAX_CARGO_BED_FT}` });
        if (result.error) return { error: `cargoBed.${side} ${result.error}` };
        if (result.value !== undefined) bed[side] = result.value;
      }
      truck.cargoBed = Object.keys(bed).length ? bed : undefined;
    }
  }

  if (given('features')) {
    if (isBlank(body.features)) {
      truck.features = undefined;
    } else if (typeof body.features !== 'object') {
      return { error: `features must be yes or no for: ${TRUCK_FEATURES.join(', ')}` };
    } else {
      truck.features = Object.fromEntries(TRUCK_FEATURES.map((feature) => [feature, body.features[feature] === true]));
    }
  }

  if (given('insurance')) {
    if (isBlank(body.insurance)) {
      truck.insurance = undefined;
    } else if (typeof body.insurance !== 'object') {
      return { error: 'insurance must give type, company, policyNumber and validUntil' };
    } else {
      const insurance = {};
      const readers = {
        type: () => readChoice(body.insurance.type, INSURANCE_TYPES),
        company: () => readText(body.insurance.company, { maxLength: 60 }),
        policyNumber: () => readText(body.insurance.policyNumber, { maxLength: 40 }),
        validUntil: () => readDate(body.insurance.validUntil),
      };
      for (const [field, read] of Object.entries(readers)) {
        const result = read();
        if (result.error) return { error: `insurance.${field} ${result.error}` };
        if (result.value !== undefined) insurance[field] = result.value;
      }
      truck.insurance = Object.keys(insurance).length ? insurance : undefined;
    }
  }

  if (given('baseLocation')) {
    if (isBlank(body.baseLocation)) {
      truck.baseLocation = undefined;
    } else {
      const { area, error: areaError } = validateArea(body.baseLocation);
      if (areaError) return { error: `Base location: ${areaError}` };
      truck.baseLocation = area;
    }
  }

  if (!creating && given('status')) {
    if (!TRUCK_STATUSES.includes(body.status)) return { error: 'Invalid truck status' };
    truck.status = body.status;
  }

  return { truck };
};

const truckValidator = (creating) => (req, res, next) => {
  const { truck, error } = cleanTruck(req.body || {}, { creating });
  // cleanTruck composes one of dozens of field-specific sentences (allowed
  // makes, capacity bounds, document number format...); one generic code
  // covers all of them, with the full English detail carried as `extra` so
  // a Nepali rendering can still surface exactly what's wrong.
  if (error) return respond(res, 400, 'VALIDATION_TRUCK_FIELD', error, { detail: error });
  req.body = truck;
  next();
};

const validateCreateTruck = truckValidator(true);
const validateUpdateTruck = truckValidator(false);

const validateRating = (req, res, next) => {
  const { rating, review } = req.body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return respond(res, 400, 'VALIDATION_RATING', 'rating must be a whole number from 1 to 5');
  }
  if (review !== undefined && (typeof review !== 'string' || review.length > 1000)) {
    return respond(res, 400, 'VALIDATION_REVIEW_LENGTH', 'review must be text of at most 1000 characters', { max: 1000 });
  }
  next();
};

const PROFILE_TEXT_FIELDS = ['firstName', 'lastName', 'email', 'companyName'];

// Whitelists what a user may change about themselves. Anything else in the
// body (phone, role, kycStatus, rating) is dropped before it reaches the
// controller, which works only from the cleaned result.
const validateProfileUpdate = (req, res, next) => {
  const fail = (message, code, extra) => respond(res, 400, code, message, extra);
  const body = req.body || {};
  const update = {};

  for (const key of PROFILE_TEXT_FIELDS) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string') return fail(`${key} must be text`, 'VALIDATION_FIELD_TEXT_TYPE', { field: key });
    update[key] = body[key].trim();
  }

  // A complete Nepal address: each level must exist inside the one above it
  // and the ward must exist in that local level (see services/nepalLocations).
  if (body.address !== undefined) {
    const { address, error } = validateAddress(body.address);
    if (error) return fail(error, 'VALIDATION_ADDRESS', { detail: error });
    update.address = address;
  }

  if (update.firstName !== undefined && (!update.firstName || update.firstName.length > 50)) {
    return fail('firstName must be 1 to 50 characters', 'VALIDATION_FIRST_NAME_LENGTH', { max: 50 });
  }
  if (update.lastName !== undefined && update.lastName.length > 50) {
    return fail('lastName must be at most 50 characters', 'VALIDATION_LAST_NAME_LENGTH', { max: 50 });
  }
  if (update.companyName !== undefined && update.companyName.length > 100) {
    return fail('companyName must be at most 100 characters', 'VALIDATION_COMPANY_NAME_LENGTH', { max: 100 });
  }
  if (update.email) {
    if (!isValidEmail(update.email)) return fail('Enter a valid email address', 'VALIDATION_INVALID_EMAIL');
    update.email = update.email.toLowerCase();
  }

  // Optional, and separate from PROFILE_TEXT_FIELDS: it needs the +977
  // format check, not just a length limit, and an empty string clears it.
  if (body.phone !== undefined) {
    if (body.phone !== '' && !isValidPhone(body.phone)) {
      return fail('Phone number must be a valid +977 number, or left blank', 'VALIDATION_INVALID_PHONE');
    }
    update.phone = body.phone;
  }

  req.body = update;
  next();
};

const isValidLat = (v) => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
const isValidLng = (v) => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;

const validateCoordinates = (req, res, next) => {
  const { lat, lng } = req.body;
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return respond(res, 400, 'VALIDATION_COORDINATES', 'lat must be -90 to 90 and lng must be -180 to 180');
  }
  next();
};

const validatePushToken = (req, res, next) => {
  const { pushToken } = req.body;
  const { isExpoPushToken } = require('../services/push');
  if (typeof pushToken !== 'string' || !isExpoPushToken(pushToken)) {
    return respond(res, 400, 'VALIDATION_PUSH_TOKEN', 'pushToken must be a valid Expo push token');
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
  isValidEmail,
  isValidPassword,
  validateEmailSignup,
  validateEmailLogin,
  validateAdminLogin,
  validateAdminSignup,
  validateGoogleAuth,
  validateForgotPassword,
  validateResetPassword,
  validateVerifyEmail,
  validateCreateLoad,
  validateRelist,
  validateCreateQuote,
  validateCounterOffer,
  validateTruckRequest,
  validateCreateTruck,
  validateUpdateTruck,
};
