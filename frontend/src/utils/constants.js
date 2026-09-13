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
