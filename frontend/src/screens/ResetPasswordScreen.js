import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input, { InputAction } from '../components/common/Input';
import OtpInput from '../components/auth/OtpInput';
import ResendCode from '../components/auth/ResendCode';
import PasswordStrengthMeter, { passwordScore } from '../components/auth/PasswordStrengthMeter';
import { colors, spacing, type } from '../theme/tokens';
import { authService } from '../services/auth';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';
import { loginSuccess } from '../redux/slices/authSlice';

// Reached only from ForgotPasswordScreen, which already confirmed a code
// was requested for this email and passes it along as a route param.
const ResetPasswordScreen = ({ route, navigation }) => {
  const { email } = route.params;
  const dispatch = useDispatch();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to <Text style={styles.emailText}>{email}</Text>
          </Text>
        </View>

        <Card>
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
            icon="lock"
            required
            error={!passwordsMatch ? 'Passwords do not match' : null}
          />

          <Button title="Reset Password" icon="checkmark" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} style={styles.submit} />
          <Button title="Back to Login" variant="ghost" onPress={() => navigation.navigate('Login')} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginVertical: spacing.xxl },
  title: { ...type.h1, color: colors.secondary },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  emailText: { fontWeight: '700', color: colors.textPrimary },
  otpWrap: { marginBottom: spacing.sm, marginTop: spacing.sm },
  passwordInput: { marginTop: spacing.lg },
  submit: { marginTop: spacing.sm },
});

export default ResetPasswordScreen;
