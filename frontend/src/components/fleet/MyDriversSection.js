import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import PhotoSourceButtons from '../common/PhotoSourceButtons';
import { StatusPill } from '../common/SettingsList';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';
import { MAX_DOCUMENT_BYTES } from '../../utils/constants';
import { getErrorMessage, isValidPhone, toNepalPhone } from '../../utils/helpers';
import { notify, confirmAction } from '../../utils/alert';
import api from '../../services/api';
import { pickImages, takePhoto, uploadFiles } from '../../services/uploads';

const fullName = (driver) => [driver.firstName, driver.lastName].filter(Boolean).join(' ');

// Where a driver stands, in the words an owner needs: what to do next, or
// that there is nothing left to do.
const driverState = (driver, t) => {
  if (driver.kycStatus === 'approved') return { tone: 'success', icon: 'verified', label: t('trucks:drivers.state.ready') };
  if (driver.kycStatus === 'pending') return { tone: 'info', icon: 'time', label: t('trucks:drivers.state.checking') };
  if (driver.kycStatus === 'rejected') return { tone: 'error', icon: 'warning', label: t('trucks:drivers.state.rejected') };
  return { tone: 'warning', icon: 'warning', label: t('trucks:drivers.state.needsLicense') };
};

// The PIN in big separate digits, shown once after it is made, so the owner
// can read it out or show the screen to the driver.
const PinCard = ({ driver, pin, onDone }) => {
  const { t } = useTranslation();
  return (
    <Card style={styles.pinCard}>
      <Text style={styles.pinTitle}>{t('trucks:drivers.pin.title', { name: driver.firstName })}</Text>
      <View style={styles.pinDigits} accessibilityLabel={t('trucks:drivers.pin.accessibilityLabel', { pin: pin.split('').join(' ') })}>
        {pin.split('').map((digit, index) => (
          <View key={index} style={styles.pinDigitBox}><Text style={styles.pinDigit}>{digit}</Text></View>
        ))}
      </View>
      <Text style={styles.pinHelp}>{t('trucks:drivers.pin.help', { phone: driver.phone })}</Text>
      <Button title={t('trucks:drivers.pin.done')} icon="checkmark" size="lg" onPress={onDone} />
    </Card>
  );
};

const AddDriverForm = ({ onAdded, onCancel }) => {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const fullPhone = toNepalPhone(phone);
  const nameError = tried && !firstName.trim() ? t('trucks:drivers.form.nameError') : null;
  const phoneError = tried && !isValidPhone(fullPhone) ? t('trucks:drivers.form.phoneError') : null;

  const save = async () => {
    setTried(true);
    if (!firstName.trim() || !isValidPhone(fullPhone)) return;
    setSaving(true);
    try {
      const { data } = await api.post('/users/me/drivers', { firstName: firstName.trim(), lastName: lastName.trim(), phone: fullPhone });
      onAdded(data.driver, data.pin);
    } catch (error) {
      notify(t('trucks:drivers.form.couldNotAddTitle'), getErrorMessage(error));
      setSaving(false);
    }
  };

  return (
    <Card>
      <Text style={styles.formTitle}>{t('trucks:drivers.form.title')}</Text>
      <Input label={t('trucks:drivers.form.firstName')} value={firstName} onChangeText={setFirstName} icon="person" error={nameError} required />
      <Input label={t('trucks:drivers.form.lastName')} value={lastName} onChangeText={setLastName} icon="person" />
      <Input
        label={t('trucks:drivers.form.phone')}
        value={phone}
        onChangeText={setPhone}
        placeholder="98XXXXXXXX"
        keyboardType="phone-pad"
        icon="phone"
        error={phoneError}
        helperText={t('trucks:drivers.form.phoneHelp')}
        required
      />
      <View style={styles.actions}>
        <Button title={t('trucks:fleet.cancelButton')} variant="ghost" onPress={onCancel} style={styles.action} />
        <Button title={t('trucks:drivers.form.save')} icon="checkmark" onPress={save} loading={saving} style={styles.action} />
      </View>
    </Card>
  );
};

const DriverRow = ({ driver, onChanged, onNewPin }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(null);
  const state = driverState(driver, t);
  const canSendLicense = driver.kycStatus === 'not_submitted' || driver.kycStatus === 'rejected';

  const sendLicense = async (source) => {
    let asset;
    try {
      asset = source === 'camera' ? (await takePhoto())[0] : (await pickImages({ max: 1 }))[0];
    } catch (error) {
      notify(t('trucks:drivers.license.couldNotOpenTitle'), getErrorMessage(error));
      return;
    }
    if (!asset) return;
    const size = asset.size || asset.fileSize;
    if (size && size > MAX_DOCUMENT_BYTES) {
      notify(t('trucks:fleet.verification.fileTooLargeTitle'), t('trucks:fleet.verification.fileTooLargeMessage'));
      return;
    }
    setBusy(source);
    try {
      await uploadFiles(`/users/me/drivers/${driver._id}/license`, [asset], { field: 'document' });
      await onChanged();
      notify(t('trucks:drivers.license.sentTitle'), t('trucks:drivers.license.sentMessage', { name: driver.firstName }));
    } catch (error) {
      notify(t('trucks:drivers.license.uploadFailedTitle'), getErrorMessage(error));
    }
    setBusy(null);
  };

  const newPin = () => confirmAction({
    title: t('trucks:drivers.newPin.title', { name: driver.firstName }),
    message: t('trucks:drivers.newPin.message'),
    confirmLabel: t('trucks:drivers.newPin.confirm'),
    onConfirm: async () => {
      setBusy('pin');
      try {
        const { data } = await api.post(`/users/me/drivers/${driver._id}/pin`);
        onNewPin(driver, data.pin);
      } catch (error) {
        notify(t('trucks:fleet.errorTitle'), getErrorMessage(error));
      }
      setBusy(null);
    },
  });

  return (
    <View style={styles.driver}>
      <View style={styles.driverTop}>
        <Icon name="driver" size={iconSize.lg} color={colors.textMuted} />
        <View style={styles.driverText}>
          <Text style={styles.driverName} numberOfLines={1}>{fullName(driver)}</Text>
          <Text style={styles.driverPhone}>{driver.phone}</Text>
        </View>
        <StatusPill label={state.label} tone={state.tone} icon={state.icon} />
      </View>

      {driver.kycStatus === 'rejected' && !!driver.kycRejectionReason && (
        <Text style={styles.reason}>{t('trucks:drivers.license.rejectedReason', { reason: driver.kycRejectionReason })}</Text>
      )}
      {driver.kycStatus === 'pending' && <Text style={styles.note}>{t('trucks:drivers.license.checkingNote')}</Text>}

      {canSendLicense && (
        <>
          <Text style={styles.note}>{t(driver.hasLicense ? 'trucks:drivers.license.retakeNote' : 'trucks:drivers.license.addNote')}</Text>
          <PhotoSourceButtons
            onTakePhoto={() => sendLicense('camera')}
            onChoose={() => sendLicense('library')}
            takeLabel={t('trucks:drivers.license.takePhoto')}
            busy={busy === 'camera' || busy === 'library' ? busy : null}
            variant="primary"
          />
        </>
      )}

      <View style={styles.actions}>
        <Button
          title={t('trucks:drivers.call')}
          icon="phone"
          variant="tertiary"
          size="sm"
          onPress={() => Linking.openURL(`tel:${driver.phone}`).catch(() => {})}
          style={styles.action}
        />
        <Button
          title={t('trucks:drivers.newPin.button')}
          icon="lock"
          variant="tertiary"
          size="sm"
          onPress={newPin}
          loading={busy === 'pin'}
          style={styles.action}
        />
      </View>
    </View>
  );
};

// "My drivers" on the Fleet page: the owner adds a driver with a name and a
// phone number, tells them the PIN FLITO makes, and sends a photo of their
// license for FLITO to check. A driver is ready for bookings once approved.
const MyDriversSection = ({ refreshKey }) => {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState([]);
  const [adding, setAdding] = useState(false);
  // { driver, pin } while a new PIN is on screen.
  const [shownPin, setShownPin] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me/drivers');
      setDrivers(data.drivers || []);
    } catch (error) {
      notify(t('trucks:fleet.errorTitle'), getErrorMessage(error));
    }
  }, [t]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleAdded = (driver, pin) => {
    setAdding(false);
    setDrivers((current) => [driver, ...current]);
    setShownPin({ driver, pin });
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{t('trucks:drivers.heading', { count: drivers.length })}</Text>
          <Text style={styles.headerHint}>{t('trucks:drivers.headerHint')}</Text>
        </View>
        {!adding && !shownPin && (
          <Button title={t('trucks:drivers.addButton')} icon="add" size="sm" onPress={() => setAdding(true)} />
        )}
      </View>

      {shownPin && <PinCard driver={shownPin.driver} pin={shownPin.pin} onDone={() => setShownPin(null)} />}
      {adding && <AddDriverForm onAdded={handleAdded} onCancel={() => setAdding(false)} />}

      {drivers.length > 0 && (
        <Card>
          {drivers.map((driver) => (
            <DriverRow
              key={driver._id}
              driver={driver}
              onChanged={load}
              onNewPin={(d, pin) => setShownPin({ driver: d, pin })}
            />
          ))}
        </Card>
      )}
      {drivers.length === 0 && !adding && !shownPin && (
        <Text style={styles.empty}>{t('trucks:drivers.empty')}</Text>
      )}
    </View>
  );
};

const styles = themedStyles(() => ({
  section: { marginTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.md },
  headerText: { flex: 1 },
  heading: { ...type.h2, color: colors.textPrimary },
  headerHint: { ...type.small, color: colors.textSecondary, marginTop: spacing.xxs },
  empty: { ...type.body, color: colors.textMuted },
  formTitle: { ...type.h3, color: colors.textPrimary, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1, marginVertical: 0 },
  driver: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  driverTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  driverText: { flex: 1, minWidth: 0 },
  driverName: { ...type.bodyLarge, fontWeight: '600', color: colors.textPrimary },
  driverPhone: { ...type.small, color: colors.textSecondary },
  note: { ...type.small, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
  reason: { ...type.small, color: colors.errorText, marginTop: spacing.sm },
  pinCard: { borderWidth: 2, borderColor: colors.primaryText },
  pinTitle: { ...type.h3, color: colors.textPrimary, textAlign: 'center' },
  pinDigits: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  pinDigitBox: {
    width: 56,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigit: { fontSize: 36, fontWeight: '700', color: colors.textPrimary },
  pinHelp: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
}));

export default MyDriversSection;
