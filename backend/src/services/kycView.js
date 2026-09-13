const storage = require('./storage');
const {
  EDITABLE_KYC_STATUSES,
  requiredDocumentsFor,
  optionalDocumentsFor,
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
const kycView = (user) => ({
  status: user.kycStatus,
  rejectionReason: user.kycStatus === 'rejected' ? user.kycRejectionReason : undefined,
  submittedAt: user.kycSubmittedAt,
  reviewedAt: user.kycReviewedAt,
  canEdit: EDITABLE_KYC_STATUSES.includes(user.kycStatus),
  requiredDocuments: requiredDocumentsFor(user.role),
  optionalDocuments: optionalDocumentsFor(user.role),
  missingDocuments: missingDocuments(user),
  documents: (user.kycDocuments || []).map(documentView),
});

// A submission as an admin reviews it.
const reviewView = (user) => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  role: user.role,
  companyName: user.companyName,
  submittedAt: user.kycSubmittedAt,
  requiredDocuments: requiredDocumentsFor(user.role),
  documents: (user.kycDocuments || []).map(documentView),
});

module.exports = { documentView, kycView, reviewView };
