import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import BookingDetailScreen from '../src/screens/BookingDetailScreen';
import { renderWithProviders, fakeUser } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const api = require('../src/services/api').default;

const BOOKING_ID = 'booking-1';

const baseBooking = (overrides = {}) => ({
  _id: BOOKING_ID,
  loadId: { goodsType: 'Cement bags', pickupLocation: { address: 'Kathmandu' }, dropoffLocation: { address: 'Pokhara' } },
  shipperId: { _id: 'shipper-id', firstName: 'Ram', lastName: 'Shrestha' },
  ownerId: { _id: 'owner-id', firstName: 'Bikash', lastName: 'Thapa', companyName: '' },
  driverId: { _id: 'driver-id', firstName: 'Hari', lastName: 'Tamang' },
  totalAmount: 15000,
  status: 'confirmed',
  pickupStatus: 'pending',
  dropoffStatus: 'pending',
  createdAt: new Date().toISOString(),
  ...overrides,
});

// `extraGetRoutes` lets a test add handlers (e.g. '/users/lookup') on top of
// the booking fetch every test needs, without each one re-declaring it.
const renderAs = (user, booking, extraGetRoutes = {}) => {
  api.get.mockImplementation((url) => {
    if (url === `/bookings/${BOOKING_ID}`) return Promise.resolve({ data: { booking } });
    if (url in extraGetRoutes) return extraGetRoutes[url]();
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
  return renderWithProviders(<BookingDetailScreen route={{ params: { bookingId: BOOKING_ID } }} />, { user });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("driver's job-status actions", () => {
  const driver = fakeUser('driver', { _id: 'driver-id' });

  it('offers pickup actions before pickup, and reports picked up correctly', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { findByText, queryByText } = renderAs(driver, baseBooking({ status: 'confirmed', pickupStatus: 'pending' }));

    expect(await findByText('Arrived at Pickup')).toBeTruthy();
    expect(await findByText('Picked Up')).toBeTruthy();
    expect(queryByText('Arrived at Dropoff')).toBeNull();
    expect(queryByText('Share My Location')).toBeNull(); // not in_transit yet

    fireEvent.press(await findByText('Picked Up'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/bookings/${BOOKING_ID}/status`,
      { pickupStatus: 'picked_up', status: 'in_transit' },
    ));
  });

  it('offers dropoff actions once picked up, and shares location while in transit', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { findByText, queryByText } = renderAs(driver, baseBooking({
      status: 'in_transit', pickupStatus: 'picked_up', dropoffStatus: 'pending',
    }));

    expect(await findByText('Arrived at Dropoff')).toBeTruthy();
    expect(await findByText('Delivered')).toBeTruthy();
    expect(queryByText('Arrived at Pickup')).toBeNull();
    expect(await findByText('Share My Location')).toBeTruthy();

    fireEvent.press(await findByText('Delivered'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/bookings/${BOOKING_ID}/status`,
      { dropoffStatus: 'delivered', status: 'completed' },
    ));
  });

  it('hides the job-status card once completed or cancelled', async () => {
    const { findByText, queryByText } = renderAs(driver, baseBooking({ status: 'completed', pickupStatus: 'picked_up', dropoffStatus: 'delivered' }));

    await findByText('Cement bags'); // wait for load
    expect(queryByText('Update Job Status')).toBeNull();
    expect(queryByText('Share My Location')).toBeNull();
  });
});

describe("shipper's cancel and rating actions", () => {
  const shipper = fakeUser('shipper', { _id: 'shipper-id' });

  it('can cancel while pending, not once in transit', async () => {
    const pending = renderAs(shipper, baseBooking({ status: 'pending' }));
    expect(await pending.findByText('Cancel Booking')).toBeTruthy();

    // A fresh screen instance, not a live transition: BookingDetailScreen
    // only refetches on mount or an explicit action/pull-to-refresh, so a bare
    // re-render with new mock data correctly would not change anything here.
    const inTransit = renderAs(shipper, baseBooking({ status: 'in_transit' }));
    await inTransit.findByText('Cement bags');
    expect(inTransit.queryByText('Cancel Booking')).toBeNull();
  });

  it('cancelling calls the status endpoint with cancelled', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { findByText } = renderAs(shipper, baseBooking({ status: 'confirmed' }));

    fireEvent.press(await findByText('Cancel Booking'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/status`, { status: 'cancelled' }));
  });

  it('offers to rate the owner once completed, and submits the picked rating', async () => {
    api.post.mockResolvedValue({ data: {} });
    const { findByText } = renderAs(shipper, baseBooking({ status: 'completed', ownerRating: undefined }));

    expect(await findByText('Rate the Owner')).toBeTruthy();
    fireEvent.press(await findByText('4'));
    fireEvent.press(await findByText('Submit Rating'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/rate`, { rating: 4, review: '' }));
  });

  it('hides the rating form once already rated', async () => {
    const { findByText, queryByText } = renderAs(shipper, baseBooking({
      status: 'completed',
      ownerRating: { rating: 5, ratedAt: new Date().toISOString() },
    }));

    await findByText('Cement bags');
    expect(queryByText('Rate the Owner')).toBeNull();
  });
});

describe("owner assigning a driver", () => {
  const owner = fakeUser('owner', { _id: 'owner-id' });

  it('offers the assign form only while unassigned', async () => {
    const { findByText, queryByText } = renderAs(owner, baseBooking({ status: 'pending', driverId: undefined }));
    expect(await findByText('Assign a Driver')).toBeTruthy();

    const { queryByText: queryAssigned } = renderAs(owner, baseBooking({ status: 'pending' })); // driverId present
    await waitFor(() => expect(queryAssigned('Assign a Driver')).toBeNull());
  });

  it('looks up the driver, then assigns them once verified', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { findByText, getByPlaceholderText } = renderAs(owner, baseBooking({ driverId: undefined }), {
      '/users/lookup': () => Promise.resolve({ data: { driver: { _id: 'driver-2', firstName: 'Sita', kycStatus: 'approved' } } }),
    });
    await findByText('Assign a Driver');

    fireEvent.changeText(getByPlaceholderText('+9779841234567'), '+9779800000009');
    fireEvent.press(await findByText('Find & Assign'));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/users/lookup', { params: { phone: '+9779800000009' } }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      `/bookings/${BOOKING_ID}/assign-driver`,
      { driverId: 'driver-2' },
    ));
  });

  it('refuses to assign an unverified driver without calling assign-driver', async () => {
    const { findByText, getByPlaceholderText } = renderAs(owner, baseBooking({ driverId: undefined }), {
      '/users/lookup': () => Promise.resolve({ data: { driver: { _id: 'driver-2', firstName: 'Sita', kycStatus: 'not_submitted' } } }),
    });
    const { notify } = require('../src/utils/alert');
    await findByText('Assign a Driver');

    fireEvent.changeText(getByPlaceholderText('+9779841234567'), '+9779800000009');
    fireEvent.press(await findByText('Find & Assign'));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('Driver not verified', expect.stringContaining('Sita')));
    expect(api.patch).not.toHaveBeenCalled();
  });
});
