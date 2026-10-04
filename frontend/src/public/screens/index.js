import React from 'react';
import { Platform } from 'react-native';
import LandingScreen from './LandingScreen';
import AboutScreen from './AboutScreen';
import MissionScreen from './MissionScreen';
import HowItWorksScreen from './HowItWorksScreen';
import SafetyScreen from './SafetyScreen';
import HelpScreen from './HelpScreen';
import ContactScreen from './ContactScreen';
import { TermsScreen, PrivacyScreen } from './LegalScreen';
import { PUBLIC_PAGES } from '../pages';

export { LandingScreen };

const SCREENS = {
  HowItWorks: HowItWorksScreen,
  Safety: SafetyScreen,
  About: AboutScreen,
  Mission: MissionScreen,
  Help: HelpScreen,
  Contact: ContactScreen,
  Terms: TermsScreen,
  Privacy: PrivacyScreen,
};

// Registers every information page in a stack, the same way in the Auth and
// Profile stacks. `siteChrome` is true where the page draws the public site's
// own navbar (the web while signed out), so the stack header steps aside;
// elsewhere the stack's header gives the page its title and back arrow.
export const renderPublicScreens = (Stack, t, { siteChrome = false } = {}) => PUBLIC_PAGES.map((page) => (
  <Stack.Screen
    key={page.route}
    name={page.route}
    component={SCREENS[page.route]}
    options={{ title: t(`site:pages.${page.key}.label`), headerShown: !siteChrome }}
  />
));

// The public site's chrome is drawn only on the web, and only signed out.
export const SITE_CHROME_SIGNED_OUT = Platform.OS === 'web';
