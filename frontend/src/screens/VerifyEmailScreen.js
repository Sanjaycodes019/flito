import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import OtpInput from '../components/auth/OtpInput';
import ResendCode from '../components/auth/ResendCode';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize } from '../theme/tokens';
import { authService } from '../services/auth';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';
import { setUser } from '../redux/slices/authSlice';

const VerifyEmailScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      const data = await authService.resendVerification();
      if (data.verificationCode) notify('Dev mode', `Verification code for testing: ${data.verificationCode}`);
      setSentAt(Date.now());
    } catch (error) {
      notify('Could not resend', getErrorMessage(error));
    }
    setResending(false);
  };

  const handleSubmit = async () => {
    if (code.length !== 6) return;
    setSubmitting(true);
    try {
      const data = await authService.verifyEmail(user.email, code);
      dispatch(setUser(data.user));
      notify('Email verified', 'Thanks, your email is confirmed.', () => navigation.goBack());
    } catch (error) {
      notify('Could not verify', getErrorMessage(error));
    }
    setSubmitting(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Icon name="unverified" size={iconSize.xl} color={colors.warningText} />
        </View>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to <Text style={styles.emailText}>{user?.email}</Text>
        </Text>
      </View>

      <Card>
        <View style={styles.otpWrap}>
          <OtpInput value={code} onChange={setCode} editable={!submitting} />
        </View>
        <ResendCode sentAt={sentAt} onResend={handleResend} disabled={resending} />

        <Button title="Verify Email" icon="checkmark" onPress={handleSubmit} loading={submitting} disabled={code.length !== 6} style={styles.submit} />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  header: { alignItems: 'center', marginVertical: spacing.xxl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.warningMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...type.h1, color: colors.secondary },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  emailText: { fontWeight: '700', color: colors.textPrimary },
  otpWrap: { marginBottom: spacing.sm, marginTop: spacing.sm },
  submit: { marginTop: spacing.sm },
});

export default VerifyEmailScreen;
