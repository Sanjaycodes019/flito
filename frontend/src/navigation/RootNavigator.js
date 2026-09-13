import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import Spinner from '../components/common/Spinner';
import { navigationRef } from './navigationRef';

const RootNavigator = () => {
  const { token, hydrated } = useSelector((state) => state.auth);

  if (!hydrated) {
    return <Spinner />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {token ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
