import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ChooseLanguageScreen from '../screens/ChooseLanguageScreen';
import LoginScreen from '../screens/LoginScreen';
import PinLoginScreen from '../screens/PinLoginScreen';
import SignupScreen from '../screens/SignupScreen';
import AdminAccessScreen from '../screens/AdminAccessScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import { colors, type } from '../theme/tokens';
import { isLanguageChosen } from '../i18n';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      // A new device starts on the language choice (in both languages), then Log In.
      initialRouteName={isLanguageChosen() ? 'Login' : 'ChooseLanguage'}
      screenOptions={{
        headerTintColor: colors.primaryText,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary, fontSize: type.h3.fontSize, fontWeight: type.h3.fontWeight },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ChooseLanguage" component={ChooseLanguageScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PinLogin" component={PinLoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AdminAccess" component={AdminAccessScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: t('navigation:auth.forgotPassword') }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: t('navigation:auth.resetPassword') }} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
