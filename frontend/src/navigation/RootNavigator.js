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

const RootNavigator = () => {
  const { token, hydrated } = useSelector((state) => state.auth);

  if (!hydrated) {
    return <Spinner />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      {token ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
