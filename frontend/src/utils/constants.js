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

// Mirror the server's limits so the app stops offering "Add" at the cap.
export const MAX_LOAD_PHOTOS = 6;
export const MAX_DELIVERY_PHOTOS = 5;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

// Which documents each role needs comes from the server; these are only the
// display names.
export const KYC_DOCUMENT_LABELS = {
  citizenship_front: 'Citizenship card (front)',
  citizenship_back: 'Citizenship card (back)',
  driving_license: 'Driving license',
  pan: 'PAN certificate',
  company_registration: 'Company registration',
};
