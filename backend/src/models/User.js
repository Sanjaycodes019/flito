const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { KYC_DOCUMENT_TYPES } = require('../services/kycPolicy');

const userSchema = new mongoose.Schema(
  {
    // Optional: email + password (or Google) is the account identifier now.
    // `sparse` keeps the unique index from colliding on the many accounts
    // that never set one.
    phone: {
      type: String,
      unique: true,
      sparse: true,
      match: /^\+977\d{10}$/,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      minlength: 8,
      select: false,
    },
    // Set only for an account created (or linked) via "Continue with
    // Google". A Google-only account has no `password`.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
    // A 4-digit login PIN, set only on a driver an owner added from their
    // fleet (see controllers/fleetDriversController). Such a driver logs in
    // with phone + PIN instead of email + password. Wrong guesses are
    // counted and lock PIN login for a while (see authController.pinLogin).
    pin: { type: String, select: false },
    pinFailedAttempts: { type: Number, select: false },
    pinLockedUntil: { type: Date, select: false },
    // The owner who added this driver, if one did.
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    // One-time 6-digit codes emailed via Brevo (see services/verification):
    // a SHA-256 hash of the code, when it expires, when it was sent (for the
    // resend cooldown), and how many wrong tries it has had.
    emailVerificationCode: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    emailVerificationSentAt: { type: Date, select: false },
    emailVerificationAttempts: { type: Number, select: false },
    passwordResetCode: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordResetSentAt: { type: Date, select: false },
    passwordResetAttempts: { type: Number, select: false },
    role: {
      type: String,
      enum: ['shipper', 'owner', 'driver', 'admin'],
      required: true,
    },
    firstName: String,
    lastName: String,
    // A square-cropped photo in public storage, set only through the upload
    // endpoint (never from a URL the client sends). `publicId` is kept so a
    // replaced or removed photo's file can be deleted.
    avatar: {
      url: String,
      publicId: String,
    },
    // A Nepal address in the federal structure: province, district and local
    // level by Survey Department P-code, ward number, and free-text tole.
    // Checked against services/nepalLocations before it is saved.
    // `coordinates` is kept only when the user filled it in from their location.
    address: {
      provinceId: String,
      districtId: String,
      localLevelId: String,
      ward: Number,
      tole: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    companyName: String, // For owners
    bankDetails: {
      bankName: String,
      accountNumber: String,
    },

    // "not_submitted" until the user sends documents for review, only then
    // "pending", so the admin queue holds real submissions, not every signup.
    kycStatus: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected'],
      default: 'not_submitted',
    },
    // Identity documents live in private storage. Only storage identifiers are
    // kept here, never a URL that could be shared or leaked.
    kycDocuments: [
      {
        type: { type: String, enum: KYC_DOCUMENT_TYPES, required: true },
        publicId: { type: String, required: true },
        format: String,
        bytes: Number,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    kycSubmittedAt: Date,
    kycReviewedAt: Date,
    kycReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kycRejectionReason: String,

    walletBalance: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    // One token per account: a login on a new device overwrites it, and
    // logout clears it, so a device only ever receives push for whoever is
    // currently signed in on it.
    pushToken: String,
  },
  { timestamps: true }
);

// Hash a password or PIN before saving, whenever one is set or changed.
userSchema.pre('save', async function (next) {
  try {
    for (const field of ['password', 'pin']) {
      if (this.isModified(field) && this[field]) {
        this[field] = await bcrypt.hash(this[field], await bcrypt.genSalt(10));
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.comparePin = async function (enteredPin) {
  if (!this.pin) return false;
  return bcrypt.compare(enteredPin, this.pin);
};

module.exports = mongoose.model('User', userSchema);
