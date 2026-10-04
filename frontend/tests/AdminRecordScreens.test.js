import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import UserDetailScreen from '../src/admin/screens/detail/UserDetailScreen';
import TruckDetailScreen from '../src/admin/screens/detail/TruckDetailScreen';
import BookingDetailScreen from '../src/admin/screens/detail/BookingDetailScreen';
import LoadDetailScreen from '../src/admin/screens/detail/LoadDetailScreen';
import TrucksScreen from '../src/admin/screens/TrucksScreen';
import { renderWithProviders, fakeUser } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockNavigation = { navigate: jest.fn(), push: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
  useNavigation: () => mockNavigation,
}));

const api = require('../src/services/api').default;

const EMPTY_PAGE = { page: 1, limit: 5, total: 0, totalPages: 1 };
const page = (items) => ({ page: 1, limit: 5, total: items.length, totalPages: 1 });

const kyc = (overrides = {}) => ({
  status: 'pending', identityDocuments: [], requiredDocuments: [], missingDocuments: [], documents: [], ...overrides,
});

const USER = {
  _id: 'u1',
  name: 'Bikash Thapa',
  firstName: 'Bikash',
  lastName: 'Thapa',
  companyName: 'Thapa Transport',
  role: 'owner',
  status: 'active',
  email: 'bikash@flito.test',
  emailVerified: true,
  phone: '+9779800000002',
  phoneVerified: true,
  avatarUrl: null,
  address: { formatted: 'Basantapur, Ward 20, Kathmandu Metropolitan City, Kathmandu, Bagmati Province' },
  bank: { bankName: 'Nabil Bank', account: '•••• 9012' },
  walletBalance: 0,
  rating: 4.5,
  totalRatings: 2,
  signIn: { password: false, pin: true, google: false },
  pinLocked: false,
  pushEnabled: true,
  memberSince: '2026-01-01T00:00:00.000Z',
  addedBy: null,
  kyc: kyc(),
};

const TRUCK_ROW = {
  _id: 't1', registrationNumber: 'BA 2 KHA 4567', truckType: '10-ton', capacity: 10000, makeModel: 'Tata 1613', verificationStatus: 'approved',
};

// Routes each GET to the fixture for its path: the record page itself, and
// the related lists it pages through.
const mockGets = (routes) => {
  api.get.mockImplementation((url) => {
    if (url in routes) {
      const value = routes[url];
      return value instanceof Error ? Promise.reject(value) : Promise.resolve({ data: value });
    }
    if (url === '/admin/stats') return Promise.resolve({ data: { stats: {} } });
    const key = url.split('/').pop();
    return Promise.resolve({ data: { [key]: [], pagination: EMPTY_PAGE } });
  });
};

const renderUser = (user = USER, { me = fakeUser('admin'), counts = {}, history = [], trucks = [] } = {}) => {
  mockGets({
    '/admin/users/u1': { user, counts: { bookings: 0, completedBookings: 0, trucks: trucks.length, drivers: 0, ...counts }, history },
    '/admin/trucks': { trucks, pagination: page(trucks) },
  });
  return renderWithProviders(<UserDetailScreen route={{ params: { userId: 'u1' } }} />, { user: me });
};

beforeEach(() => {
  jest.clearAllMocks();
  api.patch.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
});

describe("a user's page", () => {
  it('shows who they are, how to reach them and what they have on FLITO', async () => {
    const screen = renderUser(USER, { trucks: [TRUCK_ROW] });

    expect(await screen.findAllByText('Bikash Thapa')).toBeTruthy();
    expect(screen.getAllByText('+977 9800000002').length).toBeGreaterThan(0);
    expect(screen.getByText('Basantapur, Ward 20, Kathmandu Metropolitan City, Kathmandu, Bagmati Province')).toBeTruthy();
    expect(screen.getByText('Nabil Bank · •••• 9012')).toBeTruthy();
    expect(screen.getByText('Phone + PIN')).toBeTruthy();

    // The owner's trucks, five to a page from the trucks list.
    expect(await screen.findByText('BA 2 KHA 4567')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/admin/trucks', { params: { ownerId: 'u1', page: 1, limit: 5, q: undefined } });
    fireEvent.press(screen.getByLabelText('BA 2 KHA 4567'));
    expect(mockNavigation.push).toHaveBeenCalledWith('AdminTruck', { truckId: 't1' });
  });

  it('approves an identity waiting for review', async () => {
    const screen = renderUser();

    fireEvent.press(await screen.findByText('Approve'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/kyc/u1', { decision: 'approved', reason: '' }));
    // The page loads the record again to show where it now stands.
    await waitFor(() => expect(api.get.mock.calls.filter(([url]) => url === '/admin/users/u1').length).toBe(2));
  });

  it('removes a verification only with a reason', async () => {
    const screen = renderUser({ ...USER, kyc: kyc({ status: 'approved', reviewedAt: '2026-02-01T00:00:00.000Z', reviewedBy: { name: 'Sita Admin' } }) });

    expect(await screen.findByText('Identity verified')).toBeTruthy();
    fireEvent.press(screen.getByText('Remove Verification'));
    // The dialog's confirm button stays off until there is a reason.
    expect(screen.getAllByRole('button', { name: 'Remove Verification' }).pop().props.accessibilityState).toMatchObject({ disabled: true });
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Reason'), 'Citizenship photo is not theirs');
    fireEvent.press(screen.getAllByText('Remove Verification').pop());

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/kyc/u1/revoke', { reason: 'Citizenship photo is not theirs' }));
  });

  it('suspends an account with an optional note', async () => {
    const screen = renderUser();

    fireEvent.press(await screen.findByText('Suspend'));
    fireEvent.changeText(screen.getByLabelText('Note (optional)'), 'Reported for fake loads');
    fireEvent.press(screen.getAllByText('Suspend').pop());

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/users/u1/status', { status: 'suspended', reason: 'Reported for fake loads' }));
  });

  it("doesn't offer an admin their own account's status buttons", async () => {
    const screen = renderUser({ ...USER, role: 'admin' }, { me: { ...fakeUser('admin'), _id: 'u1' } });

    expect(await screen.findByText('This is your own account. Another admin has to change its status.')).toBeTruthy();
    expect(screen.queryByText('Suspend')).toBeNull();
  });

  it('shows what admins have done to the account', async () => {
    const screen = renderUser(USER, {
      history: [{ _id: 'h1', action: 'user.suspended', reason: 'Fake loads', at: '2026-03-01T10:00:00.000Z', by: { name: 'Sita Admin' } }],
    });

    expect(await screen.findByText('Account suspended')).toBeTruthy();
    expect(screen.getByText('“Fake loads”')).toBeTruthy();
  });

  it('says so when the user does not exist', async () => {
    mockGets({ '/admin/users/u1': Object.assign(new Error('nope'), { response: { status: 404, data: {} } }) });
    const screen = renderWithProviders(<UserDetailScreen route={{ params: { userId: 'u1' } }} />, { user: fakeUser('admin') });

    expect(await screen.findByText('Not found')).toBeTruthy();
  });
});

const TRUCK = {
  _id: 't1',
  registrationNumber: 'BA 2 KHA 4567',
  truckType: '10-ton',
  capacity: 10000,
  makeModel: 'Tata 1613',
  year: 2019,
  status: 'active',
  features: { tarpaulin: true },
  serviceArea: 'nepal',
  bookedDays: [],
  insurance: { company: 'Shikhar', validUntil: '2000-01-01T00:00:00.000Z' },
  owner: { _id: 'u1', name: 'Bikash Thapa', phone: '+9779800000002', verified: true, status: 'active' },
  driver: null,
  verification: { status: 'pending', missingDocuments: [], documents: [], submittedAt: '2026-03-01T00:00:00.000Z' },
};

describe("a truck's page", () => {
  const renderTruck = (truck = TRUCK) => {
    mockGets({ '/admin/trucks/t1': { truck, counts: { bookings: 3, activeBookings: 1, completedBookings: 2 }, history: [] } });
    return renderWithProviders(<TruckDetailScreen route={{ params: { truckId: 't1' } }} />, { user: fakeUser('admin') });
  };

  it('shows its papers, warning about expired ones, and its owner', async () => {
    const screen = renderTruck();

    expect(await screen.findAllByText('BA 2 KHA 4567')).toBeTruthy();
    expect(screen.getByText(/^Expired /)).toBeTruthy();
    expect(screen.getByText('No driver assigned.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Bikash Thapa'));
    expect(mockNavigation.push).toHaveBeenCalledWith('AdminUser', { userId: 'u1' });
  });

  it('rejects papers with a reason', async () => {
    const screen = renderTruck();

    fireEvent.changeText(await screen.findByPlaceholderText(/Reason \(required to reject/), 'Bluebook photo is blurred');
    fireEvent.press(screen.getByText('Reject'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/trucks/t1', { decision: 'rejected', reason: 'Bluebook photo is blurred' }));
  });
});

const BOOKING = {
  _id: 'b1',
  status: 'confirmed',
  pickupStatus: 'pending',
  dropoffStatus: 'pending',
  createdAt: '2026-03-01T00:00:00.000Z',
  shipper: { _id: 's1', name: 'Ram Sharma', phone: '+9779800000001', status: 'active' },
  owner: { _id: 'u1', name: 'Bikash Thapa', status: 'active' },
  driver: null,
  truck: TRUCK_ROW,
  load: {
    _id: 'l1', goodsType: 'Cement', weight: 6000, trucksNeeded: 1, trucksBooked: 1,
    pickup: { label: 'Balaju, Kathmandu', address: 'Balaju, Ward 16, Kathmandu' }, dropoff: { label: 'Lakeside, Pokhara', address: 'Lakeside, Ward 6, Pokhara' },
  },
  offer: { price: 15000, openedBy: 'owner', acceptedAt: '2026-03-01T00:00:00.000Z' },
  payment: { total: 15000, paid: 0, pending: 15000, method: null, status: 'pending', records: [] },
  location: null,
  deliveryPhotos: [],
  deliverySignature: null,
  ratings: { byShipper: null, byOwner: null },
};

describe("a booking's page", () => {
  it('shows the trip and its people, and cancels it with a reason', async () => {
    mockGets({ '/admin/bookings/b1': { booking: BOOKING, history: [] } });
    api.post.mockResolvedValue({
      data: {
        booking: { ...BOOKING, status: 'cancelled' },
        history: [{ _id: 'h1', action: 'booking.cancelled', reason: 'Shipper reported fraud', at: '2026-03-02T00:00:00.000Z', by: { name: 'Sita' } }],
      },
    });
    const screen = renderWithProviders(<BookingDetailScreen route={{ params: { bookingId: 'b1' } }} />, { user: fakeUser('admin') });

    expect(await screen.findAllByText('Cement')).toBeTruthy();
    expect(screen.getByText('Balaju, Ward 16, Kathmandu')).toBeTruthy();
    expect(screen.getByText('Ram Sharma')).toBeTruthy();
    expect(screen.getByText('No driver yet')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel Booking'));
    fireEvent.changeText(screen.getByLabelText('Reason'), 'Shipper reported fraud');
    fireEvent.press(screen.getAllByText('Cancel Booking').pop());

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/bookings/b1/cancel', { reason: 'Shipper reported fraud' }));
    expect(await screen.findByText('Booking cancelled by an admin')).toBeTruthy();
    expect(screen.getByText('This booking was cancelled.')).toBeTruthy();
  });
});

describe("a load's page", () => {
  it("can't remove a load once trucks are booked on it", async () => {
    mockGets({
      '/admin/loads/l1': {
        load: {
          _id: 'l1', goodsType: 'Cement', weight: 30000, weightPerTruck: 10000, trucksNeeded: 3, trucksBooked: 1, status: 'quoted',
          totalQuotes: 2, photos: [], offers: [], bookings: [], shipper: { _id: 's1', name: 'Ram Sharma', status: 'active' },
          pickup: { label: 'Balaju' }, dropoff: { label: 'Lakeside' }, createdAt: '2026-03-01T00:00:00.000Z',
        },
        history: [],
      },
    });
    const screen = renderWithProviders(<LoadDetailScreen route={{ params: { loadId: 'l1' } }} />, { user: fakeUser('admin') });

    expect(await screen.findByText('Trucks are booked for this load. To stop it, cancel those bookings from their pages.')).toBeTruthy();
    expect(screen.queryByText('Remove Load')).toBeNull();
    expect(screen.getByLabelText('1 of 3 trucks booked')).toBeTruthy();
  });
});

describe('the admin lists', () => {
  it("open a record's page from its card", async () => {
    api.get.mockImplementation((url) => (url === '/admin/trucks'
      ? Promise.resolve({ data: { trucks: [{ ...TRUCK_ROW, owner: TRUCK.owner, documents: [] }], pagination: { page: 1, limit: 12, total: 1, totalPages: 1 } } })
      : Promise.resolve({ data: { stats: {} } })));
    const screen = renderWithProviders(<TrucksScreen />, { user: fakeUser('admin') });

    fireEvent.press(await screen.findByText('View details'));
    expect(mockNavigation.push).toHaveBeenCalledWith('AdminTruck', { truckId: 't1' });
  });
});
