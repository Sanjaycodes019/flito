export const ROLES = {
  SHIPPER: 'shipper',
  OWNER: 'owner',
  DRIVER: 'driver',
  ADMIN: 'admin',
};

export const TRUCK_TYPES = ['18-wheeler', '14-ton', '10-ton', 'any'];

export const LOAD_STATUS = {
  OPEN: 'open',
  QUOTED: 'quoted',
  NEGOTIATING: 'negotiating',
  BOOKED: 'booked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_TRANSIT: 'in_transit',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const PHONE_REGEX = /^\+977\d{10}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Mirror the server's limits so the app stops offering "Add" at the cap.
export const MAX_LOAD_PHOTOS = 6;
export const MAX_DELIVERY_PHOTOS = 5;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Which documents each role needs comes from the server; these are only the
// display names.
export const KYC_DOCUMENT_LABELS = {
  citizenship_front: 'Citizenship card (front)',
  citizenship_back: 'Citizenship card (back)',
  nid_front: 'National ID card (front)',
  nid_back: 'National ID card (back)',
  driving_license: 'Driving license',
  passport: 'Passport (photo page)',
  pan: 'PAN certificate',
  company_registration: 'Company registration',
};

// The identity documents a user can verify with. The server decides which
// uploads each one needs; these are the names and icons shown for the choice.
export const KYC_ID_TYPE_OPTIONS = [
  { value: 'citizenship', label: 'Citizenship', icon: 'idCard' },
  { value: 'nid', label: 'National ID (NID)', icon: 'idCard' },
  { value: 'driving_license', label: 'Driving License', icon: 'truck' },
  { value: 'passport', label: 'Passport', icon: 'document' },
];

export const KYC_ID_TYPE_LABELS = Object.fromEntries(KYC_ID_TYPE_OPTIONS.map((o) => [o.value, o.label]));
