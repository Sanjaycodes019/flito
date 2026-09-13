import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import KycScreen from '../screens/KycScreen';
import { colors, type } from '../theme/tokens';

const Stack = createNativeStackNavigator();

// Profile is a stack so account screens (editing, identity verification) can
// open from it with a back button, the same way Home's flows do.
const ProfileStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerTintColor: colors.primary,
      headerStyle: { backgroundColor: colors.surface },
      headerTitleStyle: { color: colors.textPrimary, fontSize: type.h3.fontSize, fontWeight: type.h3.fontWeight },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <Stack.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
    <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
    <Stack.Screen name="Kyc" component={KycScreen} options={{ title: 'Identity Verification' }} />
  </Stack.Navigator>
);

export default ProfileStackNavigator;
