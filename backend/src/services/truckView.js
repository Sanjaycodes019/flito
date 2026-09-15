const { documentView } = require('./kycView');
const { REQUIRED_TRUCK_DOCUMENTS, TRUCK_DOCUMENT_TYPES } = require('../config/truckTypes');

// Papers can change, and a truck be submitted, only before review or after a
// rejection. Trucks listed before verification existed have no status yet.
const EDITABLE_TRUCK_VERIFICATION = ['not_submitted', 'rejected'];
const EDITABLE_VERIFICATION_FILTER = {
  $or: [{ verificationStatus: { $in: EDITABLE_TRUCK_VERIFICATION } }, { verificationStatus: { $exists: false } }],
};

// What an admin checked. Changing any of these on a truck under review or
// verified sends it back, so the badge always matches what was checked.
const VERIFIED_TRUCK_FIELDS = ['truckType', 'bodyType', 'capacity', 'make', 'model', 'year', 'chassisNumber', 'engineNumber'];

const verificationStatusOf = (truck) => truck.verificationStatus || 'not_submitted';

const missingTruckDocuments = (truck) => REQUIRED_TRUCK_DOCUMENTS
  .filter((type) => !(truck.verificationDocuments || []).some((doc) => doc.type === type));

// A truck's verification as its owner sees it, with signed document links.
const verificationView = (truck) => {
  const status = verificationStatusOf(truck);
  return {
    status,
    rejectionReason: status === 'rejected' ? truck.verificationRejectionReason : undefined,
    submittedAt: truck.verificationSubmittedAt,
    reviewedAt: truck.verificationReviewedAt,
    canEdit: EDITABLE_TRUCK_VERIFICATION.includes(status),
    requiredDocuments: REQUIRED_TRUCK_DOCUMENTS,
    optionalDocuments: TRUCK_DOCUMENT_TYPES.filter((type) => !REQUIRED_TRUCK_DOCUMENTS.includes(type)),
    missingDocuments: missingTruckDocuments(truck),
    documents: (truck.verificationDocuments || []).map(documentView),
  };
};

// A truck as its owner sees it: every detail, plus its verification, with no
// storage identifiers.
const ownerTruckView = (truck) => {
  const plain = typeof truck.toObject === 'function' ? truck.toObject() : { ...truck };
  const {
    verificationDocuments, verificationRejectionReason, verificationReviewedBy, verificationSubmittedAt, verificationReviewedAt,
    ...rest
  } = plain;
  return {
    ...rest,
    verificationStatus: verificationStatusOf(plain),
    verified: plain.verificationStatus === 'approved',
    verification: verificationView(truck),
  };
};

// A truck as an admin reviews it: what to check, who owns it, and the papers.
const truckReviewView = (truck) => {
  const owner = truck.ownerId || {};
  return {
    _id: truck._id,
    registrationNumber: truck.registrationNumber,
    truckType: truck.truckType,
    bodyType: truck.bodyType,
    capacity: truck.capacity,
    makeModel: truck.makeModel,
    year: truck.year,
    fuelType: truck.fuelType,
    chassisNumber: truck.chassisNumber,
    engineNumber: truck.engineNumber,
    bluebookRenewedUntil: truck.bluebookRenewedUntil,
    insurance: truck.insurance,
    emissionTestValidUntil: truck.emissionTestValidUntil,
    submittedAt: truck.verificationSubmittedAt,
    owner: {
      _id: owner._id,
      firstName: owner.firstName,
      lastName: owner.lastName,
      companyName: owner.companyName,
      phone: owner.phone,
      email: owner.email,
      verified: owner.kycStatus === 'approved',
    },
    documents: (truck.verificationDocuments || []).map(documentView),
  };
};

module.exports = {
  EDITABLE_TRUCK_VERIFICATION,
  EDITABLE_VERIFICATION_FILTER,
  VERIFIED_TRUCK_FIELDS,
  verificationStatusOf,
  missingTruckDocuments,
  ownerTruckView,
  truckReviewView,
};
