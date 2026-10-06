import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Input, { InputAction } from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import AuthMethodTabs from '../components/auth/AuthMethodTabs';
import AuthLink from '../components/auth/AuthLink';
import GoogleButton from '../components/auth/GoogleButton';
import { useGoogleAuth, isGoogleConfigured } from '../hooks/useGoogleAuth';
import { colors, spacing, radius, type, themedStyles } from '../theme/tokens';
import { authService } from '../services/auth';
import { isValidEmail, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const LoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [tried, setTried] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const dispatch = useDispatch();

  const emailError = emailTouched && !isValidEmail(email) ? t('auth:shared.invalidEmail') : null;
  const passwordError = tried && !password ? t('auth:login.passwordRequired') : null;
  const canSubmit = isValidEmail(email) && password.length > 0;

  const handleLogin = async () => {
    // The button is never greyed out: a tap on an unfinished form says what
    // is missing, which a disabled button can't.
    if (!canSubmit) {
      setEmailTouched(true);
      setTried(true);
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

  const footer = (
    <>
      <View style={styles.signUpBar}>
        <Text style={styles.signUpPrompt}>{t('auth:login.newHere')}</Text>
        <AuthLink label={t('auth:login.createAccount')} icon="add" onPress={() => navigation.navigate('Signup')} />
      </View>
      <AuthLink
        label={t('auth:admin.link')}
        icon="admin"
        tone="muted"
        onPress={() => navigation.navigate('AdminAccess')}
      />
    </>
  );

  return (
    <AuthLayout title={t('auth:login.welcome')} subtitle={t('auth:login.welcomeSubtitle')} footer={footer}>
      {/* Many users have no email, so the phone way in sits beside it. */}
      <AuthMethodTabs active="email" onSelect={() => navigation.navigate('PinLogin')} />

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
        error={passwordError}
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

      <View style={styles.forgotRow}>
        <AuthLink label={t('auth:login.forgotPassword')} onPress={() => navigation.navigate('ForgotPassword')} />
      </View>

      <Button
        title={t('auth:shared.logIn')}
        icon="login"
        size="lg"
        onPress={handleLogin}
        loading={loading}
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
    </AuthLayout>
  );
};

const styles = themedStyles(() => ({
  forgotRow: { alignSelf: 'flex-end', marginTop: -spacing.xs, marginBottom: spacing.lg },
  loginButton: { marginTop: 0 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { ...type.small, color: colors.textMuted, marginHorizontal: spacing.md },
  signUpBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  signUpPrompt: { ...type.small, color: colors.textSecondary },
}));

export default LoginScreen;
