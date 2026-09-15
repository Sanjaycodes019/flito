// The vocabulary of a truck listing, as trucks are described in Nepal.

// Truck classes as the freight trade names them, smallest to largest, with
// what each usually carries. A truck's own capacity always wins; the usual
// figure only fills in for a truck listed without one.
const TRUCK_CLASSES = {
  pickup: 1500,
  'mini-truck': 2500,
  'light-truck': 5000,
  '6-wheeler': 10000,
  '10-wheeler': 18000,
  '12-wheeler': 25000,
  trailer: 35000,
  other: null,
};

// Classes used before the list above. Trucks already listed keep them, but
// new trucks choose from TRUCK_CLASSES.
const LEGACY_TRUCK_CLASSES = {
  '6-ton': 6000,
  '10-ton': 10000,
  '14-ton': 14000,
  '18-wheeler': 25000,
};

const NOMINAL_CAPACITY_KG = { ...TRUCK_CLASSES, ...LEGACY_TRUCK_CLASSES };
const TRUCK_TYPES = Object.keys(TRUCK_CLASSES);
const ALL_TRUCK_TYPES = Object.keys(NOMINAL_CAPACITY_KG);

const BODY_TYPES = ['open', 'covered', 'flatbed', 'tipper', 'tanker', 'refrigerated'];

const FUEL_TYPES = ['diesel', 'petrol', 'electric'];

// Makes commonly sold in Nepal; anything else is "Other" with the model typed in.
const TRUCK_MAKES = ['Tata', 'Ashok Leyland', 'Eicher', 'Mahindra', 'BharatBenz', 'Isuzu', 'Foton', 'FAW', 'Dongfeng', 'Sinotruk', 'Other'];

// How far from its base a truck will work. A district or province truck is
// only matched to loads with both stops inside its base district or province.
const SERVICE_AREAS = ['nepal', 'province', 'district'];

// Third-party cover is the legal minimum; comprehensive also covers the truck.
const INSURANCE_TYPES = ['third-party', 'comprehensive'];

const TRUCK_FEATURES = ['tarpaulin', 'helper', 'gpsTracker', 'hillRoads'];

module.exports = {
  TRUCK_TYPES,
  ALL_TRUCK_TYPES,
  NOMINAL_CAPACITY_KG,
  BODY_TYPES,
  FUEL_TYPES,
  TRUCK_MAKES,
  SERVICE_AREAS,
  INSURANCE_TYPES,
  TRUCK_FEATURES,
};
