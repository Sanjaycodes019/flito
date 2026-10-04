import React from 'react';
import { Platform } from 'react-native';
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
import { LandingScreen, renderPublicScreens, SITE_CHROME_SIGNED_OUT } from '../public/screens';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      // The web opens on the public landing page, which asks for a language
      // itself. The Android app needs no landing page (its store page did that
      // job): a new device starts on the language choice, then Log In.
      initialRouteName={Platform.OS === 'web' ? 'Landing' : isLanguageChosen() ? 'Login' : 'ChooseLanguage'}
      screenOptions={{
        headerTintColor: colors.primaryText,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary, fontSize: type.h3.fontSize, fontWeight: type.h3.fontWeight },
        headerShadowVisible: false,
      }}
    >
      {Platform.OS === 'web' ? (
        <Stack.Screen name="Landing" component={LandingScreen} options={{ headerShown: false, title: t('site:pages.landing.title') }} />
      ) : null}
      <Stack.Screen name="ChooseLanguage" component={ChooseLanguageScreen} options={{ headerShown: false, title: t('common:language.label') }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false, title: t('auth:shared.logIn') }} />
      <Stack.Screen name="PinLogin" component={PinLoginScreen} options={{ headerShown: false, title: t('auth:pinLogin.title') }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false, title: t('auth:shared.signUp') }} />
      <Stack.Screen name="AdminAccess" component={AdminAccessScreen} options={{ headerShown: false, title: t('auth:admin.loginTitle') }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: t('navigation:auth.forgotPassword') }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: t('navigation:auth.resetPassword') }} />
      {renderPublicScreens(Stack, t, { siteChrome: SITE_CHROME_SIGNED_OUT })}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
