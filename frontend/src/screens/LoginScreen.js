import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import OtpInput from '../components/auth/OtpInput';
import ResendCode from '../components/auth/ResendCode';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize } from '../theme/tokens';
import { authService } from '../services/auth';
import { isValidPhone, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('+977');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sentAt, setSentAt] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const dispatch = useDispatch();

  const phoneError = phoneTouched && !isValidPhone(phone) ? 'Enter a valid number as +977XXXXXXXXXX' : null;
  const canSendOtp = isValidPhone(phone) && !sendingOtp;

  const sendOtp = async () => {
    if (!isValidPhone(phone)) {
      setPhoneTouched(true);
      return;
    }
    setSendingOtp(true);
    try {
      const data = await authService.sendOtp(phone);
      setOtpSent(true);
      setSentAt(Date.now());
      setOtp('');
      if (data.otp) notify('Dev mode', `OTP for testing: ${data.otp}`);
    } catch (error) {
      notify('Could not send code', getErrorMessage(error));
    }
    setSendingOtp(false);
  };

  const handleLogin = async () => {
    if (otp.length < 6) return;
    setVerifying(true);
    dispatch(loginStart());
    try {
      const data = await authService.login(phone, otp);
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify('Login failed', getErrorMessage(error));
      setOtp('');
    }
    setVerifying(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Icon name="truck" size={iconSize.xl} color={colors.primary} />
          </View>
          <Text style={styles.title}>FLITO</Text>
          <Text style={styles.subtitle}>Freight & Load Interchange</Text>
        </View>

        <Card>
          {!otpSent ? (
            <>
              <Input
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                onBlur={() => setPhoneTouched(true)}
                placeholder="+9779841234567"
                keyboardType="phone-pad"
                icon="phone"
                error={phoneError}
                required
                testID="login-phone-input"
              />
              <Button
                title="Send OTP"
                icon="send"
                onPress={sendOtp}
                loading={sendingOtp}
                disabled={!canSendOtp}
              />
            </>
          ) : (
            <>
              <Text style={styles.otpPrompt}>
                Enter the 6-digit code sent to <Text style={styles.otpPhone}>{phone}</Text>
              </Text>
              <View style={styles.otpWrap}>
                <OtpInput value={otp} onChange={setOtp} editable={!verifying} />
              </View>
              <ResendCode sentAt={sentAt} onResend={sendOtp} disabled={sendingOtp} />

              <Button
                title="Log In"
                icon="checkmark"
                onPress={handleLogin}
                loading={verifying}
                disabled={otp.length < 6}
                style={styles.loginButton}
              />
              <Button
                title="Use a Different Number"
                variant="ghost"
                onPress={() => { setOtpSent(false); setOtp(''); setSentAt(null); }}
              />
            </>
          )}

          <View style={styles.divider} />

          <Button
            title="Create Account"
            variant="tertiary"
            icon="add"
            onPress={() => navigation.navigate('Signup')}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginVertical: spacing.xxxl },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...type.display, color: colors.primary, letterSpacing: 1 },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  otpPrompt: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  otpPhone: { fontWeight: '700', color: colors.textPrimary },
  otpWrap: { marginBottom: spacing.sm },
  loginButton: { marginTop: spacing.md },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
});

export default LoginScreen;
