export const ROLES = {
  SHIPPER: 'shipper',
  OWNER: 'owner',
  DRIVER: 'driver',
  ADMIN: 'admin',
};

// A truck listing, as trucks are described in Nepal. Values match the server
// (backend/src/config/truckTypes.js).

// Truck classes as the freight trade names them, with what each usually
// carries (filled in as the capacity when a class is picked) and common models.
export const FLEET_TRUCK_TYPES = [
  { value: 'pickup', label: 'Pickup', capacity: 1500, description: 'Usually up to 1.5 tonnes', examples: 'Mahindra Bolero, Tata Yodha' },
  { value: 'mini-truck', label: 'Mini Truck', capacity: 2500, description: 'Usually up to 2.5 tonnes', examples: 'Tata Ace, Ashok Leyland Dost' },
  { value: 'light-truck', label: 'Light Truck (Canter)', capacity: 5000, description: 'Usually 3 to 7 tonnes', examples: 'Tata 407, Eicher Pro' },
  { value: '6-wheeler', label: '6-Wheeler Truck', capacity: 10000, description: 'Usually 9 to 12 tonnes', examples: 'Tata 1613, Ashok Leyland 1616' },
  { value: '10-wheeler', label: '10-Wheeler Truck', capacity: 18000, description: 'Usually 15 to 20 tonnes', examples: 'Tata 2518, BharatBenz 2523' },
  { value: '12-wheeler', label: '12-Wheeler Truck', capacity: 25000, description: 'Usually 20 to 25 tonnes', examples: 'Tata 3118, Ashok Leyland 3118' },
  { value: 'trailer', label: 'Trailer', capacity: 35000, description: '25 tonnes and more', examples: 'Low-bed and long trailers' },
  { value: 'other', label: 'Other Vehicle', capacity: null, description: 'Enter its capacity', examples: '' },
];

// Classes from before the list above. Trucks listed with them keep them.
export const LEGACY_TRUCK_TYPES = [
  { value: '6-ton', label: '6-Ton Truck', capacity: 6000, description: 'Older class: pick a current one', examples: '' },
  { value: '10-ton', label: '10-Ton Truck', capacity: 10000, description: 'Older class: pick a current one', examples: '' },
  { value: '14-ton', label: '14-Ton Truck', capacity: 14000, description: 'Older class: pick a current one', examples: '' },
  { value: '18-wheeler', label: '18-Wheeler', capacity: 25000, description: 'Older class: pick a current one', examples: '' },
];

export const TRUCK_TYPE_LABELS = Object.fromEntries([...FLEET_TRUCK_TYPES, ...LEGACY_TRUCK_TYPES].map((t) => [t.value, t.label]));

export const BODY_TYPES = [
  { value: 'open', label: 'Open Body', description: 'Side walls, no roof' },
  { value: 'covered', label: 'Covered / Container', description: 'Closed box body' },
  { value: 'flatbed', label: 'Flatbed', description: 'Flat deck, no walls' },
  { value: 'tipper', label: 'Tipper', description: 'Sand, gravel and aggregate' },
  { value: 'tanker', label: 'Tanker', description: 'Fuel, water or milk' },
  { value: 'refrigerated', label: 'Refrigerated', description: 'Cold chain goods' },
];

export const BODY_TYPE_LABELS = Object.fromEntries(BODY_TYPES.map((b) => [b.value, b.label]));

export const FUEL_TYPES = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'electric', label: 'Electric' },
];

// Makes commonly sold in Nepal; anything else is "Other" with the model typed in.
export const TRUCK_MAKES = ['Tata', 'Ashok Leyland', 'Eicher', 'Mahindra', 'BharatBenz', 'Isuzu', 'Foton', 'FAW', 'Dongfeng', 'Sinotruk', 'Other'];

export const SERVICE_AREAS = [
  { value: 'nepal', label: 'Anywhere in Nepal', description: 'Loads to and from any district' },
  { value: 'province', label: 'Within its province', description: 'Both stops in the base province' },
  { value: 'district', label: 'Within its district', description: 'Both stops in the base district' },
];

export const INSURANCE_TYPES = [
  { value: 'third-party', label: 'Third-Party', description: 'The minimum the law requires' },
  { value: 'comprehensive', label: 'Comprehensive', description: 'Also covers damage to the truck' },
];

// Papers an admin checks a truck against.
export const TRUCK_DOCUMENT_LABELS = {
  bluebook: 'Bluebook',
  truck_photo: 'Photo of the truck with its number plate',
  insurance: 'Insurance paper',
};

export const TRUCK_FEATURES = [
  { key: 'tarpaulin', label: 'Tarpaulin cover', short: 'Tarpaulin', description: 'Keeps goods dry in the rain' },
  { key: 'helper', label: 'Helper (khalasi) comes along', short: 'Helper', description: 'An extra hand for loading and unloading' },
  { key: 'gpsTracker', label: 'GPS tracker fitted', short: 'GPS', description: 'The truck can be followed on a map' },
  { key: 'hillRoads', label: 'Handles hill and dirt roads', short: 'Hill roads', description: 'Fit for rough routes off the highway' },
];

// Mirrors the server's limits for posting a load.
export const MAX_LOAD_WEIGHT_KG = 60000;
export const PICKUP_DAYS_SHOWN = 7;

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
