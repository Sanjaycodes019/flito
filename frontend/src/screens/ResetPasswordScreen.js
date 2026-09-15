import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import Button from '../components/common/Button';
import Input, { InputAction } from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import OtpInput from '../components/auth/OtpInput';
import ResendCode from '../components/auth/ResendCode';
import PasswordStrengthMeter, { passwordScore } from '../components/auth/PasswordStrengthMeter';
import { colors, spacing } from '../theme/tokens';
import { authService } from '../services/auth';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';
import { loginSuccess } from '../redux/slices/authSlice';

// Reached from ForgotPasswordScreen, which already confirmed a code was
// requested for this email and passes it along as a route param.
const ResetPasswordScreen = ({ route, navigation }) => {
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
      <AuthLayout title="Reset Password" subtitle="We need your email again. Request a new code to continue.">
        <Button title="Request a New Code" icon="email" onPress={() => navigation.replace('ForgotPassword')} />
        <Button title="Back to Login" variant="ghost" onPress={() => navigation.navigate('Login')} />
      </AuthLayout>
    );
  }

  const passwordsMatch = !confirmPassword || password === confirmPassword;
  const canSubmit = code.length === 6 && passwordScore(password) >= 2 && password === confirmPassword;

  const handleResend = async () => {
    setResending(true);
    try {
      const data = await authService.forgotPassword(email);
      if (data.resetCode) notify('Dev mode', `Reset code for testing: ${data.resetCode}`);
      setSentAt(Date.now());
    } catch (error) {
      notify('Could not resend', getErrorMessage(error));
    }
    setResending(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const data = await authService.resetPassword(email, code, password);
      notify('Password changed', 'You are now logged in with your new password.', () => dispatch(loginSuccess(data)));
    } catch (error) {
      notify('Could not reset password', getErrorMessage(error));
    }
    setSubmitting(false);
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle={<>Enter the 6-digit code sent to <Text style={styles.emailText}>{email}</Text></>}
    >
      <View style={styles.otpWrap}>
        <OtpInput value={code} onChange={setCode} editable={!submitting} />
      </View>
      <ResendCode sentAt={sentAt} onResend={handleResend} disabled={resending} />

      <Input
        label="New Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        icon="lock"
        required
        containerStyle={styles.passwordInput}
        rightElement={
          <InputAction
            icon={showPassword ? 'eyeOff' : 'eye'}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          />
        }
      />
      <PasswordStrengthMeter password={password} />

      <Input
        label="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Type it again"
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        icon="lock"
        required
        error={!passwordsMatch ? 'Passwords do not match' : null}
      />

      <Button title="Reset Password" icon="checkmark" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} style={styles.submit} />
      <Button title="Back to Login" variant="ghost" onPress={() => navigation.navigate('Login')} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  emailText: { fontWeight: '700', color: colors.textPrimary },
  otpWrap: { marginBottom: spacing.sm, marginTop: spacing.xs },
  passwordInput: { marginTop: spacing.lg },
  submit: { marginTop: spacing.sm },
});

export default ResetPasswordScreen;
