// KYC rules in one place, so the policy can change without hunting through
// controllers and screens.

const KYC_DOCUMENT_TYPES = [
  'citizenship_front',
  'citizenship_back',
  'driving_license',
  'pan',
  'company_registration',
];

// What each role must upload before its documents can be sent for review.
const REQUIRED_DOCUMENTS = {
  shipper: ['citizenship_front', 'citizenship_back'],
  owner: ['citizenship_front', 'citizenship_back', 'pan'],
  driver: ['citizenship_front', 'citizenship_back', 'driving_license'],
  admin: [],
};

// Accepted when provided, never required.
const OPTIONAL_DOCUMENTS = {
  owner: ['company_registration'],
};

// Documents can change before submission or after a rejection. While under
// review or once approved they are frozen, so what the admin reviewed is what
// stays on record.
const EDITABLE_KYC_STATUSES = ['not_submitted', 'rejected'];

// A verified name must keep matching the documents it was checked against.
const NAME_LOCKED_KYC_STATUSES = ['pending', 'approved'];

// What verification unlocks. An action needs the acting role to be verified
// only when that role is listed; everything else (browsing, posting loads,
// and every shipper action) stays open to unverified accounts.
const VERIFIED_ROLES_REQUIRED = {
  // Putting a price on a load or agreeing to one: submitting a quote,
  // countering, or accepting a shipper's counter (which books the load).
  makeOffer: ['owner'],
  // Being assigned by an owner to drive a booking.
  beAssignedToBooking: ['driver'],
};

const requiredDocumentsFor = (role) => REQUIRED_DOCUMENTS[role] || [];
const optionalDocumentsFor = (role) => OPTIONAL_DOCUMENTS[role] || [];
const allowedDocumentsFor = (role) => [...requiredDocumentsFor(role), ...optionalDocumentsFor(role)];

const missingDocuments = (user) => {
  const uploaded = new Set((user.kycDocuments || []).map((doc) => doc.type));
  return requiredDocumentsFor(user.role).filter((type) => !uploaded.has(type));
};

const requiresVerification = (action, role) => (VERIFIED_ROLES_REQUIRED[action] || []).includes(role);

module.exports = {
  KYC_DOCUMENT_TYPES,
  EDITABLE_KYC_STATUSES,
  NAME_LOCKED_KYC_STATUSES,
  requiredDocumentsFor,
  optionalDocumentsFor,
  allowedDocumentsFor,
  missingDocuments,
  requiresVerification,
};
