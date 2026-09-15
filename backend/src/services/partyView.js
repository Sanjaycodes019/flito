const mongoose = require('mongoose');

// How people and trucks on the other side of a load or booking are shown:
// enough to decide whether to work with them, including whether an admin has
// verified them, but never where a verification otherwise stands or anything
// it was based on.

// User fields to populate for a counterparty. kycStatus is read only to work
// out `verified`, and dropped before the response.
const PARTY_FIELDS = 'firstName lastName companyName rating totalRatings kycStatus';

// A populated document, rather than a bare id.
const isDocument = (ref) => Boolean(ref) && typeof ref === 'object' && !(ref instanceof mongoose.Types.ObjectId);

const partyView = (user) => {
  if (!isDocument(user)) return user;
  const { kycStatus, ...rest } = user;
  return { ...rest, verified: kycStatus === 'approved' };
};

const truckPartyView = (truck) => {
  if (!isDocument(truck)) return truck;
  const { verificationStatus, ...rest } = truck;
  return { ...rest, verified: verificationStatus === 'approved' };
};

// A document with its populated people and trucks swapped for the views
// above. `people` and `trucks` name the populated paths.
const withVerification = (doc, { people = [], trucks = [] } = {}) => {
  const plain = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  people.forEach((path) => { plain[path] = partyView(plain[path]); });
  trucks.forEach((path) => { plain[path] = truckPartyView(plain[path]); });
  return plain;
};

module.exports = { PARTY_FIELDS, partyView, withVerification };
