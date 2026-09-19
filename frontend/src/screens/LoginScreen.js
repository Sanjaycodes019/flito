import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Input, { InputAction } from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import GoogleButton from '../components/auth/GoogleButton';
import { useGoogleAuth, isGoogleConfigured } from '../hooks/useGoogleAuth';
import { colors, spacing, type } from '../theme/tokens';
import { authService } from '../services/auth';
import { isValidEmail, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const LoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const dispatch = useDispatch();

  const emailError = emailTouched && !isValidEmail(email) ? t('auth:shared.invalidEmail') : null;
  const canSubmit = isValidEmail(email) && password.length > 0;

  const handleLogin = async () => {
    if (!canSubmit) {
      setEmailTouched(true);
      return;
    }
    setLoading(true);
    dispatch(loginStart());
    try {
      const data = await authService.login(email.trim().toLowerCase(), password);
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify(t('auth:login.loginFailedTitle'), getErrorMessage(error));
    }
    setLoading(false);
  };

  const handleGoogleResult = async (idToken, error) => {
    if (!idToken) {
      setGoogleLoading(false);
      if (error === 'not_configured') {
        notify(t('auth:google.notConfiguredTitle'), t('auth:google.notConfiguredMessage'));
      } else if (error) {
        notify(t('auth:login.googleSignInFailedTitle'), error);
      }
      return;
    }
    try {
      const data = await authService.googleAuth(idToken);
      dispatch(loginSuccess(data));
    } catch (err) {
      if (err.response?.data?.code === 'ROLE_REQUIRED') {
        // No FLITO account for this Google account yet: continue straight
        // into sign up with the already-verified token, so the user only
        // picks a role instead of going through Google a second time.
        navigation.navigate('Signup', { googleIdToken: idToken, googleProfile: err.response.data.profile });
      } else {
        notify(t('auth:login.googleSignInFailedTitle'), getErrorMessage(err));
      }
    }
    setGoogleLoading(false);
  };

  const { promptGoogleSignIn } = useGoogleAuth(handleGoogleResult);

  return (
    <AuthLayout title={t('auth:shared.logIn')} subtitle={t('auth:login.subtitle')}>
      <Input
        label={t('auth:shared.emailLabel')}
        value={email}
        onChangeText={setEmail}
        onBlur={() => setEmailTouched(true)}
        placeholder={t('auth:shared.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        icon="email"
        error={emailError}
        required
        testID="login-email-input"
      />
      <Input
        label={t('auth:shared.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth:login.passwordPlaceholder')}
        secureTextEntry={!showPassword}
        autoComplete="current-password"
        icon="lock"
        required
        onSubmitEditing={handleLogin}
        rightElement={
          <InputAction
            icon={showPassword ? 'eyeOff' : 'eye'}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? t('auth:shared.hidePassword') : t('auth:shared.showPassword')}
          />
        }
      />

      <Button
        title={t('auth:login.forgotPassword')}
        variant="ghost"
        size="sm"
        onPress={() => navigation.navigate('ForgotPassword')}
        style={styles.forgotButton}
      />

      <Button
        title={t('auth:shared.logIn')}
        icon="checkmark"
        onPress={handleLogin}
        loading={loading}
        disabled={!canSubmit}
        style={styles.loginButton}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth:shared.or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Never disabled: an unconfigured client still answers the tap with
          a clear "not available yet" message instead of a dead click. */}
      <GoogleButton
        onPress={() => { setGoogleLoading(isGoogleConfigured()); promptGoogleSignIn(); }}
        loading={googleLoading}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchPrompt}>{t('auth:login.noAccountPrompt')}</Text>
        <Button
          title={t('auth:shared.signUp')}
          variant="tertiary"
          icon="add"
          onPress={() => navigation.navigate('Signup')}
        />
      </View>
      <Button
        title={t('auth:admin.link')}
        variant="ghost"
        size="sm"
        onPress={() => navigation.navigate('AdminAccess')}
        style={styles.adminLink}
      />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  forgotButton: { alignSelf: 'flex-end', marginTop: -spacing.sm },
  adminLink: { alignSelf: 'center', marginTop: spacing.md },
  loginButton: { marginTop: spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { ...type.small, color: colors.textMuted, marginHorizontal: spacing.sm },
  switchRow: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  switchPrompt: { ...type.small, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xs },
});

export default LoginScreen;
