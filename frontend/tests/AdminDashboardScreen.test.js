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

const renderDashboard = ({ users = [], trucks = [PENDING_TRUCK] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/admin/stats') return Promise.resolve({ data: { stats: { userCount: 5, loadCount: 2, bookingCount: 1, pendingKyc: users.length, pendingTrucks: trucks.length } } });
    if (url === '/admin/kyc/pending') return Promise.resolve({ data: { users } });
    if (url === '/admin/trucks/pending') return Promise.resolve({ data: { trucks } });
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
