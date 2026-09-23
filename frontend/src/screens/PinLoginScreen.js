import React, { useState } from 'react';
import { Text, Linking } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import OtpInput from '../components/auth/OtpInput';
import { colors, spacing, type, themedStyles } from '../theme/tokens';
import { authService } from '../services/auth';
import { getErrorMessage, isValidPhone, toNepalPhone } from '../utils/helpers';
import { notify } from '../utils/alert';
import { SUPPORT_PHONE } from '../utils/constants';

const PIN_LENGTH = 4;

// Mobile number + 4-digit PIN, no email or password: for people who signed
// up by phone, set a PIN in Settings, or are drivers an owner added.
const PinLoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [tried, setTried] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const fullPhone = toNepalPhone(phone);
  const phoneOk = isValidPhone(fullPhone);
  const canSubmit = phoneOk && pin.length === PIN_LENGTH;

  const handleLogin = async () => {
    // The button is never greyed out: a tap on an unfinished form says
    // what is missing, which a disabled button can't.
    if (!canSubmit) {
      setPhoneTouched(true);
      setTried(true);
      return;
    }
    setLoading(true);
    dispatch(loginStart());
    try {
      dispatch(loginSuccess(await authService.pinLogin(fullPhone, pin)));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify(t('auth:pinLogin.failedTitle'), getErrorMessage(error));
      setPin('');
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('auth:pinLogin.title')} subtitle={t('auth:pinLogin.subtitle')}>
      <Input
        label={t('auth:pinLogin.phoneLabel')}
        value={phone}
        onChangeText={setPhone}
        onBlur={() => setPhoneTouched(true)}
        placeholder={t('auth:pinLogin.phonePlaceholder')}
        keyboardType="phone-pad"
        autoComplete="tel"
        icon="phone"
        error={phoneTouched && !phoneOk ? t('auth:pinLogin.phoneError') : null}
        required
      />

      <Text style={styles.pinLabel}>{t('auth:pinLogin.pinLabel')}</Text>
      <OtpInput length={PIN_LENGTH} value={pin} onChange={setPin} autoFocus={false} />
      {tried && pin.length < PIN_LENGTH && <Text style={styles.error}>{t('auth:pinLogin.pinError')}</Text>}

      <Button
        title={t('auth:pinLogin.logIn')}
        icon="checkmark"
        size="lg"
        onPress={handleLogin}
        loading={loading}
        style={styles.loginButton}
      />
      <Text style={styles.hint}>{t('auth:pinLogin.forgotPin')}</Text>
      {SUPPORT_PHONE ? (
        <Button
          title={t('auth:pinLogin.callSupport')}
          icon="phone"
          variant="tertiary"
          onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {})}
          style={styles.support}
        />
      ) : null}

      <Button
        title={t('auth:pinLogin.emailInstead')}
        variant="ghost"
        size="sm"
        onPress={() => navigation.navigate('Login')}
        style={styles.emailLink}
      />
    </AuthLayout>
  );
};

const styles = themedStyles(() => ({
  pinLabel: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  error: { ...type.small, color: colors.errorText, marginTop: spacing.xs },
  loginButton: { marginTop: spacing.lg },
  hint: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  support: { marginTop: spacing.md },
  emailLink: { alignSelf: 'center', marginTop: spacing.lg },
}));

export default PinLoginScreen;
