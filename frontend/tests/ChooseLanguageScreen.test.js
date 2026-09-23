import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import ChooseLanguageScreen from '../src/screens/ChooseLanguageScreen';
import i18n, { changeLanguage, isLanguageChosen } from '../src/i18n';
import { renderWithProviders } from './testUtils';

afterEach(() => changeLanguage('en'));

it('switches the app to the picked language and moves on to Log In', async () => {
  const navigation = { replace: jest.fn() };
  const { findByLabelText } = renderWithProviders(<ChooseLanguageScreen navigation={navigation} />);

  fireEvent.press(await findByLabelText('नेपाली'));

  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Login'));
  expect(i18n.language).toBe('ne');
  expect(isLanguageChosen()).toBe(true);
});
