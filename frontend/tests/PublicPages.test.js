import React from 'react';
import { fireEvent, act } from '@testing-library/react-native';
import { getStateFromPath, NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { changeLanguage } from '../src/i18n';
import LandingScreen from '../src/public/screens/LandingScreen';
import HelpScreen from '../src/public/screens/HelpScreen';
import { TermsScreen, PrivacyScreen } from '../src/public/screens/LegalScreen';
import PublicNavbar from '../src/public/components/PublicNavbar';
import SettingsScreen from '../src/screens/settings/SettingsScreen';
import SignupScreen from '../src/screens/SignupScreen';
import { buildLinking } from '../src/navigation/RootNavigator';
import { renderWithProviders, fakeNavigation, fakeUser } from './testUtils';
import termsEn from '../src/i18n/locales/en/legal.json';

jest.mock('../src/services/auth', () => ({
  authService: { me: jest.fn(() => Promise.resolve({ user: {} })), logout: jest.fn() },
}));

const SIGNED_OUT = { auth: { user: null, token: null, isLoading: false, error: null, hydrated: true } };

// The pages read navigation and safe-area insets from context (as screens
// inside a real navigator do), so each render supplies them.
const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderPage = (ui, { navigation = fakeNavigation(), params, user } = {}) => ({
  navigation,
  ...renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <NavigationContext.Provider value={navigation}>
        <NavigationRouteContext.Provider value={{ key: 'test', name: 'Test', params }}>
          {ui}
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </SafeAreaProvider>,
    user ? { user } : { preloadedState: SIGNED_OUT }
  ),
});

beforeEach(async () => {
  jest.clearAllMocks();
  await changeLanguage('en');
});

describe('web addresses', () => {
  it('opens /terms as the Terms page whether signed in or not', () => {
    const signedOut = getStateFromPath('/terms', buildLinking(false).config);
    expect(signedOut.routes[0].name).toBe('Terms');

    const signedIn = getStateFromPath('/terms', buildLinking(true).config);
    expect(signedIn.routes[0].name).toBe('Profile');
    expect(signedIn.routes[0].state.routes.map((r) => r.name)).toEqual(['ProfileHome', 'Terms']);
  });

  it('opens / as the landing page signed out and the dashboard signed in', () => {
    expect(getStateFromPath('/', buildLinking(false).config).routes[0].name).toBe('Landing');
    expect(getStateFromPath('/', buildLinking(true).config).routes[0].name).toBe('HomeTab');
  });

  it('keeps a chosen role in the sign up address', () => {
    const state = getStateFromPath('/signup?role=owner', buildLinking(false).config);
    expect(state.routes[0]).toMatchObject({ name: 'Signup', params: { role: 'owner' } });
  });
});

describe('landing page', () => {
  it('sends each kind of visitor to the right way in', async () => {
    const { navigation, findByLabelText } = renderPage(<LandingScreen />);

    fireEvent.press(await findByLabelText('I own trucks'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Signup', { role: 'owner' });

    fireEvent.press(await findByLabelText('Post a load'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Signup', { role: 'shipper' });

    fireEvent.press(await findByLabelText('Driver? Log in with your phone number'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinLogin', undefined);
  });

  it('switches the steps when another role is chosen', async () => {
    const { findByText, findByRole, queryByText } = renderPage(<LandingScreen />);
    expect(await findByText('Post your load')).toBeTruthy();

    fireEvent.press(await findByRole('tab', { name: 'Driver' }));
    expect(await findByText('One button at each stop')).toBeTruthy();
    expect(queryByText('Post your load')).toBeNull();
  });

  it('reads in Nepali', async () => {
    await act(() => changeLanguage('ne'));
    const { findByText } = renderPage(<LandingScreen />);
    expect(await findByText('रित्तो फर्कने यात्रा')).toBeTruthy();
  });
});

describe('navbar', () => {
  it('opens every page from the menu on a phone', async () => {
    const { navigation, findByLabelText, findByText } = renderPage(<PublicNavbar pageKey="landing" />);
    fireEvent.press(await findByLabelText('Open menu'));
    fireEvent.press(await findByText('Safety & trust'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Safety');
  });
});

describe('help center', () => {
  it('finds answers by searching questions and answers', async () => {
    const { findByLabelText, findByText, queryByText } = renderPage(<HelpScreen />);
    fireEvent.changeText(await findByLabelText('Search the help center'), 'pin');
    expect(await findByText('I forgot my PIN. What do I do?')).toBeTruthy();
    expect(queryByText('How do I post a load?')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    const { findByLabelText, findByText } = renderPage(<HelpScreen />);
    fireEvent.changeText(await findByLabelText('Search the help center'), 'zzzz');
    expect(await findByText(/Nothing matched "zzzz"/)).toBeTruthy();
  });

  it('opens on the topic named in the address', async () => {
    const { findByText, queryByText } = renderPage(<HelpScreen />, { params: { topic: 'payments' } });
    expect(await findByText('How do I pay for a trip?')).toBeTruthy();
    expect(queryByText('How do I post a load?')).toBeNull();
  });
});

describe('legal pages', () => {
  it('shows the summary and every section of the Terms', async () => {
    const { findByText, getAllByText } = renderPage(<TermsScreen />);
    expect(await findByText('The short version')).toBeTruthy();
    termsEn.terms.sections.forEach((section) => {
      // Once in the body; the contents list repeats it.
      expect(getAllByText(section.title, { exact: false }).length).toBeGreaterThan(0);
    });
  });

  it('inside the app, links to the other pages through the profile', async () => {
    const { navigation, findByText } = renderPage(<PrivacyScreen />, { user: fakeUser('owner') });
    fireEvent.press(await findByText('Terms of Service'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Profile', { screen: 'Terms', initial: false });
  });
});

describe('settings', () => {
  it('lists the help, about and legal pages', async () => {
    const navigation = fakeNavigation();
    const { findByLabelText } = renderWithProviders(<SettingsScreen navigation={navigation} />, { user: fakeUser('shipper') });

    fireEvent.press(await findByLabelText('Privacy Policy'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Privacy');

    fireEvent.press(await findByLabelText('Help center'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Help');
  });
});

describe('sign up', () => {
  it('starts with the role from the link, and opens the Terms from the checkbox text', async () => {
    const navigation = fakeNavigation();
    const { findByLabelText, findAllByText } = renderPage(
      <SignupScreen navigation={navigation} route={{ params: { role: 'owner' } }} />,
      { navigation }
    );
    expect((await findByLabelText(/^Truck Owner,/)).props.accessibilityState).toMatchObject({ selected: true });

    // The first is the checkbox's link; the page's footer links repeat the name.
    fireEvent.press((await findAllByText('Terms of Service'))[0]);
    expect(navigation.navigate).toHaveBeenLastCalledWith('Terms');
  });
});
