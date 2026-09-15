import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import KycScreen from '../screens/KycScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import useBreakpoint from '../hooks/useBreakpoint';
import stackScreenOptions from './stackScreenOptions';

const Stack = createNativeStackNavigator();

// Profile is a stack so account screens (editing, identity verification) can
// open from it with a back button, the same way Home's flows do.
const ProfileStackNavigator = () => {
  const { isDesktop } = useBreakpoint();

  return (
    <Stack.Navigator screenOptions={stackScreenOptions({ isDesktop, activeTab: 'Profile', rootScreen: 'ProfileHome' })}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Kyc" component={KycScreen} options={{ title: 'Identity Verification' }} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verify Email' }} />
    </Stack.Navigator>
  );
};

export default ProfileStackNavigator;
