import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import AdminDashboardScreen from '../src/screens/AdminDashboardScreen';
import { renderWithProviders, fakeUser } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const api = require('../src/services/api').default;

const PENDING_TRUCK = {
  _id: 'truck-1',
  registrationNumber: 'BA 2 KHA 4567',
  truckType: '6-wheeler',
  bodyType: 'open',
  capacity: 10000,
  makeModel: 'Tata 1613',
  year: 2019,
  chassisNumber: 'MAT447206K1A12345',
  engineNumber: '697TC31ABC12345',
  owner: { _id: 'owner-1', firstName: 'Bikash', lastName: 'Thapa', companyName: 'Thapa Transport', phone: '+9779800000002', verified: true },
  documents: [
    { _id: 'doc-1', type: 'bluebook', format: 'pdf', url: 'https://example.com/bluebook.pdf' },
    { _id: 'doc-2', type: 'truck_photo', format: 'png', url: 'https://example.com/truck.png' },
  ],
};

const paginationFor = (items) => ({ page: 1, limit: 10, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / 10)) });

const noUsers = () => ({ users: [], pagination: paginationFor([]) });

// `userList(page)` answers the users list, which only loads once its section opens.
const renderDashboard = ({ users = [], trucks = [PENDING_TRUCK], userList = noUsers } = {}) => {
  api.get.mockImplementation((url, config) => {
    if (url === '/admin/users') return Promise.resolve({ data: userList(config?.params?.page || 1) });
    if (url === '/admin/stats') return Promise.resolve({ data: { stats: { userCount: 5, loadCount: 2, bookingCount: 1, pendingKyc: users.length, pendingTrucks: trucks.length } } });
    if (url === '/admin/kyc/pending') return Promise.resolve({ data: { users, pagination: paginationFor(users) } });
    if (url === '/admin/trucks/pending') return Promise.resolve({ data: { trucks, pagination: paginationFor(trucks) } });
    return Promise.reject(new Error(`unmocked GET ${url}`));
  });
  return renderWithProviders(<AdminDashboardScreen />, { user: fakeUser('admin') });
};

beforeEach(() => {
  jest.clearAllMocks();
  api.patch.mockResolvedValue({ data: {} });
});

describe('truck verification queue', () => {
  it('shows each waiting truck with its owner and papers', async () => {
    const screen = renderDashboard();

    expect(await screen.findByText('Truck Verification Queue (1)')).toBeTruthy();
    expect(screen.getByText('BA 2 KHA 4567')).toBeTruthy();
    expect(screen.getByText('6-Wheeler Truck · Open Body · 10,000 kg · Tata 1613 · 2019')).toBeTruthy();
    expect(screen.getByText('Owner: Thapa Transport · +9779800000002 (identity verified)')).toBeTruthy();
    expect(screen.getByLabelText('Open Bluebook')).toBeTruthy();
    expect(screen.getByLabelText('Open Photo of the truck with its number plate')).toBeTruthy();
  });

  it('approves a truck', async () => {
    const screen = renderDashboard();

    fireEvent.press(await screen.findByText('Approve'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/trucks/truck-1', { decision: 'approved', reason: undefined }));
  });

  it('rejects a truck only with a reason for the owner', async () => {
    const screen = renderDashboard();
    await screen.findByText('BA 2 KHA 4567');

    fireEvent.press(screen.getByText('Reject'));
    expect(api.patch).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('Reason (required to reject, the owner will see it)'), 'The bluebook photo is blurry');
    fireEvent.press(screen.getByText('Reject'));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/trucks/truck-1', {
      decision: 'rejected',
      reason: 'The bluebook photo is blurry',
    }));
  });
});

const { confirmAction } = require('../src/utils/alert');

const person = (id, firstName, status, role = 'shipper') => ({
  _id: id, firstName, lastName: 'Test', role, status, kycStatus: 'approved', email: `${firstName.toLowerCase()}@flito.test`, createdAt: '2026-09-16T00:00:00Z',
});

// Users load only when their section opens (the stat tile says 5 users).
const openUsers = async (screen) => {
  fireEvent.press(await screen.findByText('Users (5)'));
  return screen;
};

describe('users', () => {
  const ram = person('u1', 'Ram', 'active');
  const sita = person('u2', 'Sita', 'suspended');
  const hari = person('u3', 'Hari', 'banned', 'driver');
  const me = person('admin-id', 'Me', 'active', 'admin');
  const userList = () => ({ users: [ram, sita, hari, me], pagination: paginationFor([ram, sita, hari, me]) });

  it('waits until the section is opened to load anyone', async () => {
    const screen = renderDashboard({ userList });
    await screen.findByText('Truck Verification Queue (1)');

    expect(api.get).not.toHaveBeenCalledWith('/admin/users', expect.anything());
    await openUsers(screen);
    expect(await screen.findByText('Ram Test')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { page: 1, limit: 10 } });
  });

  it('offers each account only what fits where it stands, and nothing on the admin\'s own', async () => {
    const screen = await openUsers(renderDashboard({ userList }));
    await screen.findByText('Ram Test');

    // Ram is active (suspend, ban); Sita is suspended (reactivate, ban); Hari is banned (reactivate).
    expect(screen.getAllByText('Suspend')).toHaveLength(1);
    expect(screen.getAllByText('Ban')).toHaveLength(2);
    expect(screen.getAllByText('Reactivate')).toHaveLength(2);
  });

  it('suspends a user, after asking', async () => {
    const screen = await openUsers(renderDashboard({ userList }));
    await screen.findByText('Ram Test');

    fireEvent.press(screen.getByText('Suspend'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Suspend this user?', destructive: true, confirmLabel: 'Suspend',
    }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/users/u1/status', { status: 'suspended' }));
  });

  it('reactivates a user without treating it as destructive', async () => {
    const screen = await openUsers(renderDashboard({ userList }));
    await screen.findByText('Sita Test');

    fireEvent.press(screen.getAllByText('Reactivate')[0]);

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reactivate this user?', destructive: false }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/users/u2/status', { status: 'active' }));
  });

  it('refreshes the page the admin is on after a change', async () => {
    const screen = await openUsers(renderDashboard({ userList }));
    await screen.findByText('Ram Test');
    api.get.mockClear();

    fireEvent.press(screen.getByText('Suspend'));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { page: 1, limit: 10 } }));
  });

  it('pages through the list', async () => {
    const pages = {
      1: { users: [ram], pagination: { page: 1, limit: 10, total: 25, totalPages: 3 } },
      2: { users: [sita], pagination: { page: 2, limit: 10, total: 25, totalPages: 3 } },
    };
    const screen = await openUsers(renderDashboard({ userList: (page) => pages[page] }));

    expect(await screen.findByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getByText('Ram Test')).toBeTruthy();

    // No page before the first.
    fireEvent.press(screen.getByText('Previous'));
    expect(api.get).not.toHaveBeenCalledWith('/admin/users', { params: { page: 0, limit: 10 } });

    fireEvent.press(screen.getByText('Next'));
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy();
    expect(screen.getByText('Sita Test')).toBeTruthy();
    expect(screen.queryByText('Ram Test')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { page: 2, limit: 10 } });
  });

  it('shows no page controls when everything fits on one page', async () => {
    const screen = await openUsers(renderDashboard({ userList }));
    await screen.findByText('Ram Test');

    expect(screen.queryByText('Next')).toBeNull();
  });
});
