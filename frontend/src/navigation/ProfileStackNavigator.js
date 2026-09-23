import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import KycScreen from '../screens/KycScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import AddressScreen from '../screens/AddressScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import LanguageSettingsScreen from '../screens/settings/LanguageSettingsScreen';
import AppearanceSettingsScreen from '../screens/settings/AppearanceSettingsScreen';
import SecuritySettingsScreen from '../screens/settings/SecuritySettingsScreen';
import SetPinScreen from '../screens/settings/SetPinScreen';
import { useSelector } from 'react-redux';
import useBreakpoint from '../hooks/useBreakpoint';
import { AdminProfile } from '../admin/navigation';
import stackScreenOptions from './stackScreenOptions';

const Stack = createNativeStackNavigator();

// Defined once so the screen keeps its identity between renders.
const AdminProfileScreen = (props) => <AdminProfile ProfileScreen={ProfileScreen} {...props} />;

// Profile is a stack so account screens (editing, identity verification) can
// open from it with a back button, the same way Home's flows do.
const ProfileStackNavigator = () => {
  const { isDesktop, isPhone } = useBreakpoint();
  const isAdmin = useSelector((state) => state.auth.user?.role) === 'admin';
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={stackScreenOptions({ isDesktop, isPhone, isAdmin, activeTab: 'Profile', rootScreen: 'ProfileHome' })}>
      <Stack.Screen name="ProfileHome" component={isAdmin ? AdminProfileScreen : ProfileScreen} options={{ title: t('navigation:profileStack.profile') }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: t('navigation:profileStack.editProfile') }} />
      <Stack.Screen name="Kyc" component={KycScreen} options={{ title: t('navigation:profileStack.kyc') }} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: t('navigation:profileStack.verifyEmail') }} />
      <Stack.Screen name="Address" component={AddressScreen} options={{ title: t('navigation:profileStack.address') }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: t('navigation:profileStack.settings') }} />
      <Stack.Screen name="LanguageSettings" component={LanguageSettingsScreen} options={{ title: t('navigation:profileStack.languageSettings') }} />
      <Stack.Screen name="AppearanceSettings" component={AppearanceSettingsScreen} options={{ title: t('navigation:profileStack.appearanceSettings') }} />
      <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} options={{ title: t('navigation:profileStack.securitySettings') }} />
      <Stack.Screen name="SetPin" component={SetPinScreen} options={{ title: t('navigation:profileStack.setPin') }} />
    </Stack.Navigator>
  );
};

export default ProfileStackNavigator;
