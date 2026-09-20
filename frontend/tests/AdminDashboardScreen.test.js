import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import TrucksScreen from '../src/admin/screens/TrucksScreen';
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
  verificationStatus: 'pending',
  owner: { _id: 'owner-1', firstName: 'Bikash', lastName: 'Thapa', phone: '+9779800000002', verified: true },
  documents: [],
};

const renderTrucks = () => {
  api.get.mockImplementation((url) => {
    if (url === '/admin/trucks') {
      return Promise.resolve({
        data: { trucks: [PENDING_TRUCK], pagination: { page: 1, limit: 12, total: 1, totalPages: 1 } },
      });
    }
    return Promise.resolve({ data: { stats: {} } });
  });
  return renderWithProviders(<TrucksScreen />, { user: fakeUser('admin') });
};

beforeEach(() => {
  jest.clearAllMocks();
  api.patch.mockResolvedValue({ data: {} });
});

describe('admin truck verification', () => {
  it('lists a truck waiting for review with its registration', async () => {
    const screen = renderTrucks();
    expect(await screen.findByText('BA 2 KHA 4567')).toBeTruthy();
  });

  it('approves a truck', async () => {
    const screen = renderTrucks();
    fireEvent.press(await screen.findByText('Approve'));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/trucks/truck-1', { decision: 'approved', reason: '' }),
    );
  });

  it('rejects a truck only once a reason is written', async () => {
    const screen = renderTrucks();
    await screen.findByText('BA 2 KHA 4567');

    fireEvent.press(screen.getByText('Reject'));
    expect(api.patch).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText(/Reason/), 'The bluebook photo is blurry');
    fireEvent.press(screen.getByText('Reject'));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/trucks/truck-1', {
        decision: 'rejected',
        reason: 'The bluebook photo is blurry',
      }),
    );
  });
});
