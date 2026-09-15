// KYC rules in one place, so the policy can change without hunting through
// controllers and screens.

const KYC_DOCUMENT_TYPES = [
  'citizenship_front',
  'citizenship_back',
  'nid_front',
  'nid_back',
  'driving_license',
  'passport',
  'pan',
  'company_registration',
];

// The identity documents a user can choose between, and what each one needs
// uploaded. Cards with details on both sides need both; a passport needs only
// its photo page.
const ID_DOCUMENT_OPTIONS = {
  citizenship: ['citizenship_front', 'citizenship_back'],
  nid: ['nid_front', 'nid_back'],
  driving_license: ['driving_license'],
  passport: ['passport'],
};
const KYC_ID_TYPES = Object.keys(ID_DOCUMENT_OPTIONS);
const DEFAULT_KYC_ID_TYPE = 'citizenship';

// Roles that verify their identity at all. Admins are created directly and
// never go through verification.
const VERIFYING_ROLES = ['shipper', 'owner', 'driver'];

// What a role must upload on top of its chosen identity document. A driver
// who picks their driving license as identity uploads it once for both.
const ROLE_DOCUMENTS = {
  owner: ['pan'],
  driver: ['driving_license'],
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

// Accounts created before the choice existed have no kycIdType stored; they
// were verifying with citizenship, so that is what they keep.
const idTypeOf = (user) => (KYC_ID_TYPES.includes(user.kycIdType) ? user.kycIdType : DEFAULT_KYC_ID_TYPE);

const requiredDocumentsFor = (user, idType = idTypeOf(user)) => {
  if (!VERIFYING_ROLES.includes(user.role)) return [];
  return [...new Set([...ID_DOCUMENT_OPTIONS[idType], ...(ROLE_DOCUMENTS[user.role] || [])])];
};
const optionalDocumentsFor = (user) => OPTIONAL_DOCUMENTS[user.role] || [];
const allowedDocumentsFor = (user, idType = idTypeOf(user)) => [
  ...requiredDocumentsFor(user, idType),
  ...optionalDocumentsFor(user),
];

const missingDocuments = (user) => {
  const uploaded = new Set((user.kycDocuments || []).map((doc) => doc.type));
  return requiredDocumentsFor(user).filter((type) => !uploaded.has(type));
};

const requiresVerification = (action, role) => (VERIFIED_ROLES_REQUIRED[action] || []).includes(role);

module.exports = {
  KYC_DOCUMENT_TYPES,
  KYC_ID_TYPES,
  DEFAULT_KYC_ID_TYPE,
  EDITABLE_KYC_STATUSES,
  NAME_LOCKED_KYC_STATUSES,
  idTypeOf,
  requiredDocumentsFor,
  optionalDocumentsFor,
  allowedDocumentsFor,
  missingDocuments,
  requiresVerification,
};
