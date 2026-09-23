import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import OtpInput from '../../components/auth/OtpInput';
import useScreenLayout from '../../hooks/useScreenLayout';
import { setUser } from '../../redux/slices/authSlice';
import { colors, spacing, type, themedStyles } from '../../theme/tokens';
import api from '../../services/api';
import { getErrorMessage, pinProblemKey } from '../../utils/helpers';
import { notify } from '../../utils/alert';

const PIN_LENGTH = 4;

const PinField = ({ label, value, onChange }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <OtpInput length={PIN_LENGTH} value={value} onChange={onChange} autoFocus={false} />
  </View>
);

// Sets the 4-digit PIN used to log in with a phone number, or changes it
// (which needs the current one). Needs a phone number on the account.
const SetPinScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const layout = useScreenLayout('narrow');
  const changing = Boolean(user?.hasPin);
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user?.phone) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
        <Card>
          <Text style={styles.body}>{t('profile:pin.needsPhone')}</Text>
          <Button title={t('profile:pin.addPhone')} icon="phone" onPress={() => navigation.navigate('EditProfile')} />
        </Card>
      </ScrollView>
    );
  }

  const problemKey = pinProblemKey(pin);
  const problem = (() => {
    if (changing && currentPin.length < PIN_LENGTH) return t('profile:pin.enterCurrent');
    if (problemKey) return t(`auth:pinRules.${problemKey}`);
    if (pin !== confirmPin) return t('auth:pinRules.mismatch');
    return null;
  })();

  const save = async () => {
    setTried(true);
    if (problem) return;
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me/pin', { pin, ...(changing ? { currentPin } : {}) });
      dispatch(setUser(data.user));
      notify(t('profile:pin.savedTitle'), t('profile:pin.savedMessage', { phone: user.phone }), () => navigation.goBack());
    } catch (error) {
      notify(t('profile:pin.couldNotSaveTitle'), getErrorMessage(error));
      setCurrentPin('');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.body}>{t('profile:pin.intro', { phone: user.phone })}</Text>
        {changing && <PinField label={t('profile:pin.currentLabel')} value={currentPin} onChange={setCurrentPin} />}
        <PinField label={t('profile:pin.newLabel')} value={pin} onChange={setPin} />
        <PinField label={t('profile:pin.confirmLabel')} value={confirmPin} onChange={setConfirmPin} />
        {tried && problem ? <Text style={styles.error}>{problem}</Text> : null}
        <Button title={t('profile:pin.save')} icon="checkmark" size="lg" onPress={save} loading={saving} style={styles.save} />
      </Card>
    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  body: { ...type.body, color: colors.textSecondary, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.xs },
  error: { ...type.small, color: colors.errorText, marginBottom: spacing.sm },
  save: { marginTop: spacing.sm },
}));

export default SetPinScreen;
