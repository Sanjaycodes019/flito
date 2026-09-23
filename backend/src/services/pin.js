const crypto = require('crypto');

// 4-digit login PINs: easy for anyone to remember and type, used with a phone
// number instead of an email and password. Wrong guesses lock PIN login (see
// authController.pinLogin), which is what makes 4 digits safe enough.

const PIN_REGEX = /^\d{4}$/;

// PINs anyone would try first: all one digit, or a run up or down.
const isGuessablePin = (pin) => /^(\d)\1{3}$/.test(pin)
  || '0123456789'.includes(pin)
  || '9876543210'.includes(pin);

const isValidPin = (pin) => typeof pin === 'string' && PIN_REGEX.test(pin);

// A random PIN for FLITO to hand out (to an owner for their driver, or to an
// admin resetting one), never an obvious one.
const newPin = () => {
  let pin;
  do {
    pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
  } while (isGuessablePin(pin));
  return pin;
};

// Every 5 wrong PINs lock PIN use on the account, each lock twice as long as
// the one before (15 minutes, 30, 60... up to a day). A correct PIN clears
// the count. The user must be loaded with +pinFailedAttempts +pinLockedUntil.
const PIN_TRIES_PER_LOCK = 5;
const PIN_FIRST_LOCK_MS = 15 * 60 * 1000;
const PIN_MAX_LOCK_MS = 24 * 60 * 60 * 1000;

const lockMs = (failedAttempts) => Math.min(
  PIN_FIRST_LOCK_MS * 2 ** (Math.floor(failedAttempts / PIN_TRIES_PER_LOCK) - 1),
  PIN_MAX_LOCK_MS,
);

// Whole minutes until PIN use unlocks, or 0.
const pinLockedMinutes = (user) => (user.pinLockedUntil && user.pinLockedUntil > new Date()
  ? Math.ceil((user.pinLockedUntil - Date.now()) / 60000)
  : 0);

const recordWrongPin = async (user) => {
  const failedAttempts = (user.pinFailedAttempts || 0) + 1;
  const update = { pinFailedAttempts: failedAttempts };
  if (failedAttempts % PIN_TRIES_PER_LOCK === 0) {
    update.pinLockedUntil = new Date(Date.now() + lockMs(failedAttempts));
  }
  await user.constructor.updateOne({ _id: user._id }, { $set: update });
};

const clearWrongPins = async (user) => {
  if (user.pinFailedAttempts || user.pinLockedUntil) {
    await user.constructor.updateOne({ _id: user._id }, { $unset: { pinFailedAttempts: '', pinLockedUntil: '' } });
  }
};

module.exports = {
  PIN_REGEX, isGuessablePin, isValidPin, newPin, pinLockedMinutes, recordWrongPin, clearWrongPins,
};
