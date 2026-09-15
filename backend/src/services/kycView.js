const storage = require('./storage');
const { isAddressComplete } = require('./nepalLocations');
const {
  ID_DOCUMENT_OPTIONS,
  EDITABLE_KYC_STATUSES,
  requiredDocumentsFor,
  optionalDocumentsFor,
  identityOptionsFor,
  identityCoveredByRole,
  completedIdTypes,
  missingDocuments,
} = require('./kycPolicy');

// Storage identifiers never leave the server. Clients get a signed download
// link that stops working after 10 minutes, so each view fetches fresh ones.
const documentView = (doc) => ({
  _id: doc._id,
  type: doc.type,
  format: doc.format,
  bytes: doc.bytes,
  uploadedAt: doc.uploadedAt,
  url: storage.isConfigured() ? storage.privateDocumentUrl(doc.publicId, doc.format) : null,
});

// A user's own verification state.
const kycView = (user) => {
  const completed = completedIdTypes(user);
  return {
    status: user.kycStatus,
    rejectionReason: user.kycStatus === 'rejected' ? user.kycRejectionReason : undefined,
    submittedAt: user.kycSubmittedAt,
    reviewedAt: user.kycReviewedAt,
    canEdit: EDITABLE_KYC_STATUSES.includes(user.kycStatus),
    // One complete identity document is required and the rest are optional,
    // unless the role's required documents already include one (a driver's
    // license), in which case every identity document here is optional.
    identity: {
      required: !identityCoveredByRole(user),
      complete: completed.length > 0,
      options: identityOptionsFor(user).map((idType) => ({
        idType,
        documents: ID_DOCUMENT_OPTIONS[idType],
        complete: completed.includes(idType),
      })),
    },
    requiredDocuments: requiredDocumentsFor(user),
    optionalDocuments: optionalDocumentsFor(user),
    missingDocuments: missingDocuments(user),
    // An address is required before submitting, alongside the documents.
    addressComplete: isAddressComplete(user.address),
    documents: (user.kycDocuments || []).map(documentView),
  };
};

// A submission as an admin reviews it.
const reviewView = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  email: user.email,
  role: user.role,
  companyName: user.companyName,
  submittedAt: user.kycSubmittedAt,
  // The identity documents that are complete in this submission.
  identityDocuments: completedIdTypes(user),
  requiredDocuments: requiredDocumentsFor(user),
  documents: (user.kycDocuments || []).map(documentView),
});

module.exports = { documentView, kycView, reviewView };
