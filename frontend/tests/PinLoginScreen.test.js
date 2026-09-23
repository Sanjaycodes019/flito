import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import PinLoginScreen from '../src/screens/PinLoginScreen';
import { renderWithProviders, fakeNavigation } from './testUtils';

jest.mock('../src/services/auth', () => ({
  authService: { pinLogin: jest.fn() },
}));

const { authService } = require('../src/services/auth');
const { notify } = require('../src/utils/alert');

beforeEach(() => jest.clearAllMocks());

const typePin = (screen, pin) => {
  // OtpInput spreads a pasted code across its boxes from the first one.
  fireEvent.changeText(screen.getAllByLabelText(/digit/i)[0], pin);
};

it('logs a driver in with the number as they type it and their PIN', async () => {
  authService.pinLogin.mockResolvedValue({ token: 't', user: { _id: 'd1', role: 'driver', firstName: 'Hari' } });
  const screen = renderWithProviders(<PinLoginScreen navigation={fakeNavigation()} />);

  fireEvent.changeText(screen.getByLabelText('Phone number'), '98 1234 5678');
  typePin(screen, '4827');
  fireEvent.press(screen.getByText('Log In'));

  await waitFor(() => expect(authService.pinLogin).toHaveBeenCalledWith('+9779812345678', '4827'));
  await waitFor(() => expect(screen.store.getState().auth.user?.firstName).toBe('Hari'));
});

it('does not try with an incomplete number', async () => {
  const screen = renderWithProviders(<PinLoginScreen navigation={fakeNavigation()} />);

  fireEvent.changeText(screen.getByLabelText('Phone number'), '98123');
  typePin(screen, '4827');
  fireEvent.press(screen.getByText('Log In'));

  expect(await screen.findByText('Enter your 10-digit mobile number')).toBeTruthy();
  expect(authService.pinLogin).not.toHaveBeenCalled();
});

it('clears the PIN and says why after a wrong one', async () => {
  authService.pinLogin.mockRejectedValue({ response: { data: { code: 'AUTH_INVALID_PIN', message: 'Incorrect phone number or PIN' } } });
  const screen = renderWithProviders(<PinLoginScreen navigation={fakeNavigation()} />);

  fireEvent.changeText(screen.getByLabelText('Phone number'), '9812345678');
  typePin(screen, '1111');
  fireEvent.press(screen.getByText('Log In'));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('Could not log in', 'Incorrect phone number or PIN'));
});

it('says the PIN is missing instead of doing nothing', async () => {
  const screen = renderWithProviders(<PinLoginScreen navigation={fakeNavigation()} />);

  fireEvent.changeText(screen.getByLabelText('Phone number'), '9812345678');
  fireEvent.press(screen.getByText('Log In'));

  expect(await screen.findByText('Enter the 4-digit PIN')).toBeTruthy();
  expect(authService.pinLogin).not.toHaveBeenCalled();
});
