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

// The identity documents a user can verify with, and what each needs uploaded
// to count: cards with details on both sides need both, a passport only its
// photo page. At least one must be complete; any others are optional extras.
const ID_DOCUMENT_OPTIONS = {
  citizenship: ['citizenship_front', 'citizenship_back'],
  nid: ['nid_front', 'nid_back'],
  driving_license: ['driving_license'],
  passport: ['passport'],
};
const KYC_ID_TYPES = Object.keys(ID_DOCUMENT_OPTIONS);
const ID_DOCUMENT_TYPES = [...new Set(Object.values(ID_DOCUMENT_OPTIONS).flat())];

// Stands for "no identity document is complete yet" in a missing-documents list.
const IDENTITY_REQUIREMENT = 'identity';

// Roles that verify their identity at all. Admins are created directly and
// never go through verification.
const VERIFYING_ROLES = ['shipper', 'owner', 'driver'];

// What a role must upload on top of an identity document. A driver's license
// is one of these and also counts as the driver's identity document.
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

const verifies = (user) => VERIFYING_ROLES.includes(user.role);
const uploadedTypes = (user) => new Set((user.kycDocuments || []).map((doc) => doc.type));

const requiredDocumentsFor = (user) => (verifies(user) ? ROLE_DOCUMENTS[user.role] || [] : []);
const optionalDocumentsFor = (user) => (verifies(user) ? OPTIONAL_DOCUMENTS[user.role] || [] : []);

// The identity documents offered to this user. One the role already requires
// (a driver's license) isn't offered again as a separate identity choice.
const identityOptionsFor = (user) => KYC_ID_TYPES.filter(
  (idType) => !ID_DOCUMENT_OPTIONS[idType].every((type) => requiredDocumentsFor(user).includes(type)),
);

// True when a document the role already requires is itself a complete
// identity document (a driver's license), so no separate one is needed and
// every identity document on offer is optional.
const identityCoveredByRole = (user) => KYC_ID_TYPES.some(
  (idType) => ID_DOCUMENT_OPTIONS[idType].every((type) => requiredDocumentsFor(user).includes(type)),
);

// Identity documents with every part uploaded.
const completedIdTypes = (user) => {
  const uploaded = uploadedTypes(user);
  return KYC_ID_TYPES.filter((idType) => ID_DOCUMENT_OPTIONS[idType].every((type) => uploaded.has(type)));
};

const allowedDocumentsFor = (user) => (verifies(user)
  ? [...new Set([...ID_DOCUMENT_TYPES, ...requiredDocumentsFor(user), ...optionalDocumentsFor(user)])]
  : []);

// What still stands between the user and submitting: the role's documents not
// yet uploaded, then "identity" while no identity document is complete (never
// for a role whose required documents already include one).
const missingDocuments = (user) => {
  if (!verifies(user)) return [];
  const uploaded = uploadedTypes(user);
  const missing = requiredDocumentsFor(user).filter((type) => !uploaded.has(type));
  if (!identityCoveredByRole(user) && !completedIdTypes(user).length) missing.push(IDENTITY_REQUIREMENT);
  return missing;
};

// Every set of documents that makes a complete submission: the role's own
// documents plus one full identity document. Lets submission re-check
// completeness in the same database update that changes the status.
const completeDocumentSets = (user) => KYC_ID_TYPES.map(
  (idType) => [...new Set([...requiredDocumentsFor(user), ...ID_DOCUMENT_OPTIONS[idType]])],
);

const requiresVerification = (action, role) => (VERIFIED_ROLES_REQUIRED[action] || []).includes(role);

module.exports = {
  KYC_DOCUMENT_TYPES,
  KYC_ID_TYPES,
  ID_DOCUMENT_OPTIONS,
  IDENTITY_REQUIREMENT,
  EDITABLE_KYC_STATUSES,
  NAME_LOCKED_KYC_STATUSES,
  requiredDocumentsFor,
  optionalDocumentsFor,
  identityOptionsFor,
  identityCoveredByRole,
  completedIdTypes,
  allowedDocumentsFor,
  missingDocuments,
  completeDocumentSets,
  requiresVerification,
};
