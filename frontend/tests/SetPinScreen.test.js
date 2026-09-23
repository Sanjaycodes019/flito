import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import SetPinScreen from '../src/screens/settings/SetPinScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const api = require('../src/services/api').default;

beforeEach(() => jest.clearAllMocks());

const typePins = (...pins) => {
  const boxes = screen.getAllByLabelText('Digit 1 of 4');
  pins.forEach((pin, i) => fireEvent.changeText(boxes[i], pin));
};

it('sets a first PIN for an account with a phone number', async () => {
  const navigation = fakeNavigation();
  api.patch.mockResolvedValue({ data: { user: fakeUser('shipper', { phone: '+9779812345678', hasPin: true }) } });
  const { store } = renderWithProviders(<SetPinScreen navigation={navigation} />, { user: fakeUser('shipper', { phone: '+9779812345678' }) });

  typePins('5824', '5824');
  fireEvent.press(screen.getByText('Save PIN'));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/me/pin', { pin: '5824' }));
  expect(store.getState().auth.user.hasPin).toBe(true);
  expect(navigation.goBack).toHaveBeenCalled();
});

it('asks for the current PIN to change one', async () => {
  api.patch.mockResolvedValue({ data: { user: fakeUser('shipper', { phone: '+9779812345678', hasPin: true }) } });
  renderWithProviders(<SetPinScreen navigation={fakeNavigation()} />, { user: fakeUser('shipper', { phone: '+9779812345678', hasPin: true }) });

  typePins('', '5824', '5824');
  fireEvent.press(screen.getByText('Save PIN'));
  expect(await screen.findByText('Enter your current PIN')).toBeTruthy();
  expect(api.patch).not.toHaveBeenCalled();

  typePins('7391');
  fireEvent.press(screen.getByText('Save PIN'));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/users/me/pin', { pin: '5824', currentPin: '7391' }));
});

it('sends someone without a phone number to add one first', async () => {
  const navigation = fakeNavigation();
  renderWithProviders(<SetPinScreen navigation={navigation} />, { user: fakeUser('shipper') });

  fireEvent.press(await screen.findByText('Add Mobile Number'));
  expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');
});
