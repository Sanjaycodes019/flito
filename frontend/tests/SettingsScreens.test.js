import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../src/screens/settings/SettingsScreen';
import AppearanceSettingsScreen from '../src/screens/settings/AppearanceSettingsScreen';
import SecuritySettingsScreen from '../src/screens/settings/SecuritySettingsScreen';
import { renderWithProviders, fakeUser, fakeNavigation } from './testUtils';
import { getThemePreference, setThemePreference } from '../src/services/themePreference';

jest.mock('../src/services/auth', () => ({
  authService: { me: jest.fn(), logout: jest.fn() },
}));

const { confirmAction } = require('../src/utils/alert');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('settings home', () => {
  it('opens each settings page from its row', async () => {
    const navigation = fakeNavigation();
    const { findByLabelText } = renderWithProviders(<SettingsScreen navigation={navigation} />, { user: fakeUser('shipper') });

    fireEvent.press(await findByLabelText(/^Language & region/));
    expect(navigation.navigate).toHaveBeenLastCalledWith('LanguageSettings');

    fireEvent.press(await findByLabelText(/^Appearance/));
    expect(navigation.navigate).toHaveBeenLastCalledWith('AppearanceSettings');

    fireEvent.press(await findByLabelText('Sign-in & security'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('SecuritySettings');

    fireEvent.press(await findByLabelText('Personal information'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('EditProfile');
  });

  it('logs out after confirming', async () => {
    const { authService } = require('../src/services/auth');
    const { findByLabelText, store } = renderWithProviders(<SettingsScreen navigation={fakeNavigation()} />, { user: fakeUser('owner') });

    fireEvent.press(await findByLabelText('Log out'));

    expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    await waitFor(() => expect(authService.logout).toHaveBeenCalled());
    await waitFor(() => expect(store.getState().auth.token).toBeNull());
  });
});

describe('appearance settings', () => {
  it('applies the chosen theme', async () => {
    const { findByLabelText } = renderWithProviders(<AppearanceSettingsScreen />, { user: fakeUser('shipper') });

    fireEvent.press(await findByLabelText('Dark'));

    await waitFor(() => expect(getThemePreference()).toBe('dark'));
    await setThemePreference('system');
  });
});

describe('sign-in and security', () => {
  it('shows the email status and lets an unverified email be verified', async () => {
    const navigation = fakeNavigation();
    const { findByLabelText } = renderWithProviders(
      <SecuritySettingsScreen navigation={navigation} />,
      { user: fakeUser('shipper', { email: 'ram@example.com', emailVerified: false }) },
    );

    fireEvent.press(await findByLabelText('Email, ram@example.com'));

    expect(navigation.navigate).toHaveBeenCalledWith('VerifyEmail');
  });
});
