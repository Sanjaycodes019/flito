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

describe("driver's one-button job", () => {
  const driver = fakeUser('driver', { _id: 'driver-id' });
  const steps = [
    { state: { status: 'confirmed', pickupStatus: 'pending', dropoffStatus: 'pending' }, button: 'I reached the pickup', sends: { pickupStatus: 'arrived' } },
    { state: { status: 'confirmed', pickupStatus: 'arrived', dropoffStatus: 'pending' }, button: 'Goods are loaded', sends: { pickupStatus: 'picked_up', status: 'in_transit' } },
    { state: { status: 'in_transit', pickupStatus: 'picked_up', dropoffStatus: 'pending' }, button: 'I reached the drop-off', sends: { dropoffStatus: 'arrived' } },
    { state: { status: 'in_transit', pickupStatus: 'picked_up', dropoffStatus: 'arrived' }, button: 'Goods delivered', sends: { dropoffStatus: 'delivered', status: 'completed' } },
  ];

  it.each(steps)('shows only the next step ($button) and sends it', async ({ state, button, sends }) => {
    api.patch.mockResolvedValue({ data: {} });
    const { findByText, queryByText } = renderAs(driver, baseBooking(state));

    fireEvent.press(await findByText(button));
    steps.filter((other) => other.button !== button).forEach((other) => expect(queryByText(other.button)).toBeNull());

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/status`, sends));
  });

  it('says where to go and offers directions to that stop', async () => {
    const { Linking } = require('react-native');
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { findByText } = renderAs(driver, baseBooking({
      loadId: {
        goodsType: 'Cement bags',
        pickupLocation: { address: 'Kathmandu', coordinates: { lat: 27.7, lng: 85.3 } },
        dropoffLocation: { address: 'Pokhara' },
      },
    }));

    expect(await findByText('Go to the pickup')).toBeTruthy();
    fireEvent.press(await findByText('Directions'));
    expect(openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=27.7%2C85.3');
  });

  it('shares location while in transit', async () => {
    const { findByText } = renderAs(driver, baseBooking({ status: 'in_transit', pickupStatus: 'picked_up' }));
    expect(await findByText('Share My Location')).toBeTruthy();
  });

  it('hides the job card once completed', async () => {
    const { findByText, queryByText } = renderAs(driver, baseBooking({ status: 'completed', pickupStatus: 'picked_up', dropoffStatus: 'delivered' }));

    await findByText('Cement bags');
    expect(queryByText('Your next step')).toBeNull();
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

describe('asking before steps that cannot be undone', () => {
  const { confirmAction } = require('../src/utils/alert');

  it('asks before cancelling, and does nothing if the shipper backs out', async () => {
    confirmAction.mockImplementationOnce(() => {}); // the shipper taps "Cancel" in the dialog
    const { findByText } = renderAs(fakeUser('shipper', { _id: 'shipper-id' }), baseBooking({ status: 'confirmed' }));

    fireEvent.press(await findByText('Cancel Booking'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cancel this booking?', destructive: true }));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('asks before marking delivered, but not before "arrived"', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const arriving = renderAs(fakeUser('driver', { _id: 'driver-id' }), baseBooking({
      status: 'in_transit', pickupStatus: 'picked_up', dropoffStatus: 'pending',
    }));
    fireEvent.press(await arriving.findByText('I reached the drop-off'));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(confirmAction).not.toHaveBeenCalled();

    const delivering = renderAs(fakeUser('driver', { _id: 'driver-id' }), baseBooking({
      status: 'in_transit', pickupStatus: 'picked_up', dropoffStatus: 'arrived',
    }));
    fireEvent.press(await delivering.findByText('Goods delivered'));
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Goods delivered?' }));
  });
});

describe('calling the other people on the job', () => {
  const { Linking } = require('react-native');

  const withPhones = (overrides = {}) => baseBooking({
    shipperId: { _id: 'shipper-id', firstName: 'Ram', lastName: 'Shrestha', phone: '+9779800000001' },
    ownerId: { _id: 'owner-id', firstName: 'Bikash', lastName: 'Thapa', phone: '+9779800000002' },
    driverId: { _id: 'driver-id', firstName: 'Hari', lastName: 'Tamang', phone: '+9779800000003' },
    ...overrides,
  });

  it('gives the shipper a Call button for the owner and driver, not themselves', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { findByLabelText, queryByLabelText } = renderAs(fakeUser('shipper', { _id: 'shipper-id' }), withPhones());

    fireEvent.press(await findByLabelText('Call Hari Tamang'));
    expect(openURL).toHaveBeenCalledWith('tel:+9779800000003');
    expect(await findByLabelText('Call Bikash Thapa')).toBeTruthy();
    expect(queryByLabelText('Call Ram Shrestha')).toBeNull();
  });

  it('says so when a person has no phone number', async () => {
    const { findByText } = renderAs(fakeUser('driver', { _id: 'driver-id' }), withPhones({
      ownerId: { _id: 'owner-id', firstName: 'Bikash', lastName: 'Thapa' },
    }));

    expect(await findByText('No phone number added')).toBeTruthy();
  });

  it('shows no Call buttons on a cancelled booking', async () => {
    const { findByText, queryByLabelText } = renderAs(fakeUser('shipper', { _id: 'shipper-id' }), withPhones({ status: 'cancelled' }));

    await findByText('Cement bags');
    expect(queryByLabelText('Call Hari Tamang')).toBeNull();
  });
});

describe("owner picking one of their own drivers", () => {
  const owner = fakeUser('owner', { _id: 'owner-id' });
  const myDrivers = () => Promise.resolve({ data: { drivers: [
    { _id: 'd1', firstName: 'Sita', lastName: 'Rai', kycStatus: 'approved' },
    { _id: 'd2', firstName: 'Gopal', kycStatus: 'pending' },
  ] } });

  it('assigns an approved driver with one tap and a confirmation', async () => {
    api.patch.mockResolvedValue({ data: {} });
    const { findByLabelText } = renderAs(owner, baseBooking({ driverId: undefined }), { '/users/me/drivers': myDrivers });

    fireEvent.press(await findByLabelText('Assign Sita'));

    const { confirmAction } = require('../src/utils/alert');
    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Put Sita on this job?' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/assign-driver`, { driverId: 'd1' }));
  });

  it('shows a driver still being checked, without letting them be picked', async () => {
    const { findByText, queryByLabelText } = renderAs(owner, baseBooking({ driverId: undefined }), { '/users/me/drivers': myDrivers });

    expect(await findByText('Gopal: license still being checked by FLITO')).toBeTruthy();
    expect(queryByLabelText('Assign Gopal')).toBeNull();
  });
});
