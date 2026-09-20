import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import OtpInput from '../components/auth/OtpInput';
import ResendCode, { RESEND_COOLDOWN_SECONDS } from '../components/auth/ResendCode';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize, themedStyles } from '../theme/tokens';
import { authService } from '../services/auth';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';
import { setUser } from '../redux/slices/authSlice';
import useScreenLayout from '../hooks/useScreenLayout';

const VerifyEmailScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [code, setCode] = useState('');
  // This screen can open long after the signup email went out, so a new code
  // can be asked for straight away. If one was sent moments ago, the server
  // says how long to wait and the countdown picks that up.
  const [sentAt, setSentAt] = useState(null);
  const [resending, setResending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // A short code form: kept to a compact centered column on every screen.
  const layout = useScreenLayout(520);

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.resendVerification();
      setSentAt(Date.now());
      notify(t('auth:shared.codeSentTitle'), t('auth:verifyEmail.codeSentMessage', { email: user?.email }));
    } catch (error) {
      const wait = error?.response?.data?.retryAfterSeconds;
      if (error?.response?.status === 429 && wait) {
        setSentAt(Date.now() - (RESEND_COOLDOWN_SECONDS - wait) * 1000);
      } else {
        notify(t('auth:shared.couldNotResendTitle'), getErrorMessage(error));
      }
    }
    setResending(false);
  };

  const handleSubmit = async () => {
    if (code.length !== 6) return;
    setSubmitting(true);
    try {
      const data = await authService.verifyEmail(user.email, code);
      dispatch(setUser(data.user));
      notify(t('auth:verifyEmail.emailVerifiedTitle'), t('auth:verifyEmail.emailVerifiedMessage'), () => navigation.goBack());
    } catch (error) {
      notify(t('auth:verifyEmail.couldNotVerifyTitle'), getErrorMessage(error));
    }
    setSubmitting(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Icon name="unverified" size={iconSize.xl} color={colors.warningText} />
        </View>
        <Text style={styles.title}>{t('auth:verifyEmail.title')}</Text>
        <Text style={styles.subtitle}>
          {t('auth:shared.codeSentPrefix')}<Text style={styles.emailText}>{user?.email}</Text>{t('auth:shared.codeSentSuffix')}
        </Text>
      </View>

      <Card>
        <View style={styles.otpWrap}>
          <OtpInput value={code} onChange={setCode} editable={!submitting} />
        </View>
        <ResendCode sentAt={sentAt} cooldownSeconds={RESEND_COOLDOWN_SECONDS} onResend={handleResend} disabled={resending} />

        <Button title={t('auth:verifyEmail.submit')} icon="checkmark" onPress={handleSubmit} loading={submitting} disabled={code.length !== 6} style={styles.submit} />
      </Card>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
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
  title: { ...type.h1, color: colors.textPrimary },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  emailText: { fontWeight: '700', color: colors.textPrimary },
  otpWrap: { marginBottom: spacing.sm, marginTop: spacing.sm },
  submit: { marginTop: spacing.sm },
}));

export default VerifyEmailScreen;
