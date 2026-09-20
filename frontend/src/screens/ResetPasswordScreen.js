import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Button from '../components/common/Button';
import Input, { InputAction } from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import OtpInput from '../components/auth/OtpInput';
import ResendCode from '../components/auth/ResendCode';
import PasswordStrengthMeter, { passwordScore } from '../components/auth/PasswordStrengthMeter';
import { colors, spacing, themedStyles } from '../theme/tokens';
import { authService } from '../services/auth';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';
import { loginSuccess } from '../redux/slices/authSlice';

// Reached from ForgotPasswordScreen, which already confirmed a code was
// requested for this email and passes it along as a route param.
const ResetPasswordScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  // The email is deliberately kept out of the page address (see
  // RootNavigator's linking config), so after a browser refresh it is gone.
  const email = route?.params?.email;
  const dispatch = useDispatch();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Without the email this form can't work, so ask for a new code instead of
  // showing inputs that would only fail.
  if (!email) {
    return (
      <AuthLayout title={t('auth:resetPassword.title')} subtitle={t('auth:resetPassword.noEmailSubtitle')}>
        <Button title={t('auth:resetPassword.requestNewCode')} icon="email" onPress={() => navigation.replace('ForgotPassword')} />
        <Button title={t('auth:shared.backToLogin')} variant="ghost" onPress={() => navigation.navigate('Login')} />
      </AuthLayout>
    );
  }

  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const canSubmit = code.length === 6 && passwordScore(password) >= 2 && password === confirmPassword;

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.forgotPassword(email);
      setSentAt(Date.now());
      notify(t('auth:shared.codeSentTitle'), t('auth:resetPassword.codeSentMessage', { email }));
    } catch (error) {
      notify(t('auth:shared.couldNotResendTitle'), getErrorMessage(error));
    }
    setResending(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const data = await authService.resetPassword(email, code, password);
      notify(t('auth:resetPassword.passwordChangedTitle'), t('auth:resetPassword.passwordChangedMessage'), () => dispatch(loginSuccess(data)));
    } catch (error) {
      notify(t('auth:resetPassword.couldNotResetTitle'), getErrorMessage(error));
    }
    setSubmitting(false);
  };

  return (
    <AuthLayout
      title={t('auth:resetPassword.title')}
      subtitle={<>{t('auth:shared.codeSentPrefix')}<Text style={styles.emailText}>{email}</Text>{t('auth:shared.codeSentSuffix')}</>}
    >
      <View style={styles.otpWrap}>
        <OtpInput value={code} onChange={setCode} editable={!submitting} />
      </View>
      <ResendCode sentAt={sentAt} onResend={handleResend} disabled={resending} />

      <Input
        label={t('auth:resetPassword.newPasswordLabel')}
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth:shared.passwordPlaceholderMin8')}
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        icon="lock"
        required
        containerStyle={styles.passwordInput}
        rightElement={
          <InputAction
            icon={showPassword ? 'eyeOff' : 'eye'}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? t('auth:shared.hidePassword') : t('auth:shared.showPassword')}
          />
        }
      />
      <PasswordStrengthMeter password={password} />

      <Input
        label={t('auth:resetPassword.confirmNewPasswordLabel')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t('auth:resetPassword.confirmNewPasswordPlaceholder')}
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        icon="lock"
        required
        error={!passwordsMatch ? t('auth:shared.passwordsMismatch') : null}
      />

      <Button title={t('auth:resetPassword.submit')} icon="checkmark" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} style={styles.submit} />
      <Button title={t('auth:shared.backToLogin')} variant="ghost" onPress={() => navigation.navigate('Login')} />
    </AuthLayout>
  );
};

const styles = themedStyles(() => ({
  emailText: { fontWeight: '700', color: colors.textPrimary },
  otpWrap: { marginBottom: spacing.sm, marginTop: spacing.xs },
  passwordInput: { marginTop: spacing.lg },
  submit: { marginTop: spacing.sm },
}));

export default ResetPasswordScreen;
