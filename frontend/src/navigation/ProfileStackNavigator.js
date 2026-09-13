import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import KycScreen from '../screens/KycScreen';
import { FLITO_COLORS } from '../utils/colors';

const Stack = createNativeStackNavigator();

// Profile is a stack so account screens (editing, identity verification) can
// open from it with a back button, the same way Home's flows do.
const ProfileStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerTintColor: FLITO_COLORS.secondary,
      headerStyle: { backgroundColor: FLITO_COLORS.bgLight },
    }}
  >
    <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
    <Stack.Screen name="Kyc" component={KycScreen} options={{ title: 'Identity Verification' }} />
  </Stack.Navigator>
);

export default ProfileStackNavigator;
