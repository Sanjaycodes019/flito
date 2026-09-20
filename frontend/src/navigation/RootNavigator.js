import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import Spinner from '../components/common/Spinner';
import { navigationRef } from './navigationRef';
import { colors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';
import { adminLinkingScreens } from '../admin/navigation';

// Keeps screen transitions, tab bars, and the native back-swipe backdrop on
// FLITO's own palette instead of React Navigation's default white/blue.
// Built at render time so it follows light/dark mode.
const buildNavigationTheme = (scheme) => {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primaryText,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.divider,
      notification: colors.error,
    },
  };
};

// The app remounts on a light/dark change (see ThemeProvider); on Android this
// keeps the user on the same screen instead of dropping them back on Home.
// The web restores the screen from its address.
let lastNavigationState;

// Every screen has its own address (/profile, /loads/123, ...), so on the web
// a page refresh or a shared link reopens the same screen instead of falling
// back to Home, and the browser's back and forward buttons work.
//
// `initialRouteName` puts a stack's first screen underneath a deep link, so
// opening /profile/edit directly still has a back button to Profile.
//
// Some screens receive sensitive values as navigation params. `stringify`
// returning undefined keeps each out of the address bar, browser history and
// server logs: a Google ID token is a credential, and an email address is
// personal data.
const linking = {
  prefixes: ['flito://'],
  config: {
    screens: {
      // Signed out (AuthNavigator)
      Login: 'login',
      Signup: {
        path: 'signup',
        stringify: { googleIdToken: () => undefined, googleProfile: () => undefined },
      },
      AdminAccess: 'admin-access',
      ForgotPassword: 'forgot-password',
      ResetPassword: {
        path: 'reset-password',
        stringify: { email: () => undefined },
      },

      // Signed in (TabNavigator)
      HomeTab: {
        path: '',
        initialRouteName: 'Home',
        screens: {
          Home: '',
          CreateLoad: 'loads/new',
          LoadsList: 'loads',
          LoadDetail: 'loads/:loadId',
          TruckMatches: 'loads/:loadId/trucks',
          Bookings: 'bookings',
          Jobs: 'jobs',
          BookingDetail: 'bookings/:bookingId',
          MyQuotes: 'quotes',
          Fleet: 'fleet',
          Earnings: 'earnings',
          ...adminLinkingScreens,
        },
      },
      Profile: {
        path: 'profile',
        initialRouteName: 'ProfileHome',
        screens: {
          ProfileHome: '',
          EditProfile: 'edit',
          Kyc: 'verification',
          VerifyEmail: 'verify-email',
          Address: 'address',
          Settings: 'settings',
          LanguageSettings: 'settings/language',
          AppearanceSettings: 'settings/appearance',
          SecuritySettings: 'settings/security',
        },
      },
    },
  },
};

const RootNavigator = () => {
  const { token, hydrated } = useSelector((state) => state.auth);
  const { scheme } = useTheme();
  const navigationTheme = useMemo(() => buildNavigationTheme(scheme), [scheme]);

  // The container mounts only once the saved session has been checked, so it
  // reads the address after it knows whether to show the signed-in screens.
  if (!hydrated) {
    return <Spinner />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}
      linking={linking}
      fallback={<Spinner />}
      initialState={Platform.OS === 'web' ? undefined : lastNavigationState}
      onStateChange={(state) => { lastNavigationState = state; }}
    >
      {token ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
