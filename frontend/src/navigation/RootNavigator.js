import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import Spinner from '../components/common/Spinner';
import { navigationRef } from './navigationRef';
import { colors } from '../theme/tokens';

// Keeps screen transitions, tab bars, and the native back-swipe backdrop on
// FLITO's own palette instead of React Navigation's default white/blue.
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primaryText,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.divider,
    notification: colors.error,
  },
};

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
          AdminDashboard: 'admin',
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
        },
      },
    },
  },
};

const RootNavigator = () => {
  const { token, hydrated } = useSelector((state) => state.auth);

  // The container mounts only once the saved session has been checked, so it
  // reads the address after it knows whether to show the signed-in screens.
  if (!hydrated) {
    return <Spinner />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking} fallback={<Spinner />}>
      {token ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
