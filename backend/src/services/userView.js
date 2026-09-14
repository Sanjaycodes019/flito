// The account fields a user sees about themselves. Deliberately excludes KYC
// document identifiers, review internals and anything security-sensitive.
const publicUser = (user) => ({
  _id: user._id,
  phone: user.phone,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  emailVerified: user.emailVerified,
  // Whether the account can log in with a password (Google-only accounts
  // cannot), so the frontend knows whether to offer "change password".
  hasPassword: Boolean(user.password),
  // Never the raw googleId, just whether one is linked, so the frontend can
  // grey out "change email" for a Google-managed address.
  hasGoogle: Boolean(user.googleId),
  companyName: user.companyName,
  address: {
    street: user.address?.street,
    city: user.address?.city,
  },
  kycStatus: user.kycStatus,
  kycRejectionReason: user.kycStatus === 'rejected' ? user.kycRejectionReason : undefined,
  rating: user.rating,
  totalRatings: user.totalRatings,
});

module.exports = { publicUser };
