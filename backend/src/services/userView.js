// The account fields a user sees about themselves. Deliberately excludes KYC
// document identifiers, review internals and anything security-sensitive.
const publicUser = (user) => ({
  _id: user._id,
  phone: user.phone,
  role: user.role,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
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
