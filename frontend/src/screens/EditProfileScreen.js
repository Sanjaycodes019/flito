import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Spinner from '../components/common/Spinner';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';
import api from '../services/api';
import { authService } from '../services/auth';
import { setUser } from '../redux/slices/authSlice';
import useScreenLayout from '../hooks/useScreenLayout';

// Mirrors the server: a verified name must keep matching the KYC documents.
const NAME_LOCKED_KYC_STATUSES = ['pending', 'approved'];

const EditProfileScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  // Read live from the store, so an address saved on the Address screen
  // shows here straight away.
  const savedAddress = useSelector((state) => state.auth.user?.address);
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const layout = useScreenLayout('narrow');
  // From tablet width up, first and last name share a row.
  const pairStyle = layout.isPhone ? null : styles.fieldRow;
  const halfStyle = layout.isPhone ? undefined : styles.fieldHalf;

  // Load the latest profile rather than trusting whatever was cached at login.
  useEffect(() => {
    (async () => {
      try {
        const { user } = await authService.me();
        setAccount(user);
        setForm({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phone: user.phone || '',
          companyName: user.companyName || '',
        });
      } catch (error) {
        notify(t('profile:editProfile.loadFailedTitle'), getErrorMessage(error));
      }
    })();
  }, []);

  if (!form) return <Spinner />;

  const namesLocked = NAME_LOCKED_KYC_STATUSES.includes(account.kycStatus);
  const isOwner = account.role === ROLES.OWNER;
  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    const payload = {
      email: form.email,
      phone: form.phone,
    };
    if (!namesLocked) {
      payload.firstName = form.firstName;
      payload.lastName = form.lastName;
    }
    if (isOwner) payload.companyName = form.companyName;

    setSaving(true);
    let saved = null;
    try {
      const { data } = await api.patch('/users/me', payload);
      saved = data.user;
      dispatch(setUser(saved));
    } catch (error) {
      notify(t('profile:editProfile.saveFailedTitle'), getErrorMessage(error));
    }
    setSaving(false);

    if (saved) notify(t('profile:editProfile.savedTitle'), t('profile:editProfile.savedMessage'), () => navigation.goBack());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle} keyboardShouldPersistTaps="handled">
      <Card style={!layout.isPhone && styles.cardWide}>
        <View style={pairStyle}>
          <Input
            label={t('profile:editProfile.firstName')}
            value={form.firstName}
            onChangeText={update('firstName')}
            editable={!namesLocked}
            icon="person"
            containerStyle={halfStyle}
          />
          <Input
            label={t('profile:editProfile.lastName')}
            value={form.lastName}
            onChangeText={update('lastName')}
            editable={!namesLocked}
            icon="person"
            containerStyle={halfStyle}
          />
        </View>
        {namesLocked && (
          <View style={styles.lockNote}>
            <Icon name="lock" size={iconSize.xs} color={colors.textMuted} style={styles.lockIcon} />
            <Text style={styles.note}>
              {t('profile:editProfile.nameLockNote')}
            </Text>
          </View>
        )}

        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('profile:editProfile.email')}</Text>
          <View style={[styles.verifiedPill, account.emailVerified ? styles.verifiedPillOn : styles.verifiedPillOff]}>
            <Icon name={account.emailVerified ? 'verified' : 'unverified'} size={12} color={account.emailVerified ? colors.successText : colors.warningText} />
            <Text style={[styles.verifiedPillText, { color: account.emailVerified ? colors.successText : colors.warningText }]}>
              {account.emailVerified ? t('profile:editProfile.verified') : t('profile:editProfile.notVerified')}
            </Text>
          </View>
        </View>
        <Input
          value={form.email}
          onChangeText={update('email')}
          placeholder={t('profile:editProfile.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          icon="email"
          editable={!account.hasGoogle}
          helperText={
            account.hasGoogle
              ? t('profile:editProfile.emailHintGoogle')
              : account.hasPassword
                ? t('profile:editProfile.emailHintPassword')
                : undefined
          }
        />

        <Input
          label={t('profile:editProfile.phoneLabel')}
          value={form.phone}
          onChangeText={update('phone')}
          placeholder={t('profile:editProfile.phonePlaceholder')}
          keyboardType="phone-pad"
          icon="phone"
        />

        {isOwner && (
          <Input
            label={t('profile:editProfile.companyLabel')}
            value={form.companyName}
            onChangeText={update('companyName')}
            placeholder={t('profile:editProfile.companyPlaceholder')}
            icon="owner"
          />
        )}

        {/* The address has its own screen: province, district, municipality
            and ward come from official lists, with "use current location". */}
        <View style={styles.addressBlock}>
          <Text style={styles.label}>{t('profile:editProfile.addressLabel')}</Text>
          <View style={styles.addressRow}>
            <Icon name="location" size={iconSize.sm} color={colors.textMuted} />
            <Text style={[styles.addressText, !savedAddress && styles.addressTextMuted]}>
              {savedAddress?.formatted || t('profile:editProfile.addressNotAdded')}
            </Text>
          </View>
          <Button
            title={savedAddress ? t('profile:editProfile.changeAddress') : t('profile:editProfile.addAddress')}
            icon="location"
            variant="tertiary"
            size="sm"
            onPress={() => navigation.navigate('Address')}
            style={styles.addressButton}
          />
        </View>

        <View style={styles.readOnlyRow}>
          <Icon name={account.role === 'owner' ? 'owner' : account.role === 'driver' ? 'driver' : 'shipper'} size={iconSize.xs} color={colors.textMuted} style={styles.lockIcon} />
          <Text style={styles.readOnly}>{t('profile:editProfile.roleAccount', { role: t(`profile:roles.${account.role}`, account.role) })}</Text>
        </View>

        <Button
          title={t('profile:editProfile.saveChanges')}
          icon="checkmark"
          onPress={handleSave}
          loading={saving}
          style={!layout.isPhone && styles.saveWide}
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  cardWide: { padding: spacing.xxl },
  fieldRow: { flexDirection: 'row', gap: spacing.lg },
  fieldHalf: { flex: 1 },
  saveWide: { alignSelf: 'flex-end', minWidth: 220 },
  addressBlock: { marginBottom: spacing.lg },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xxs },
  addressText: { ...type.body, color: colors.textPrimary, flex: 1 },
  addressTextMuted: { color: colors.textMuted },
  addressButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
  lockNote: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -spacing.sm, marginBottom: spacing.md },
  lockIcon: { marginRight: spacing.xs, marginTop: 2 },
  note: { ...type.small, color: colors.textMuted, flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { ...type.smallMedium, color: colors.textSecondary },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  verifiedPillOn: { backgroundColor: colors.successMuted },
  verifiedPillOff: { backgroundColor: colors.warningMuted },
  verifiedPillText: { ...type.caption, fontSize: 10 },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  readOnly: { ...type.small, color: colors.textMuted, textTransform: 'capitalize' },
});

export default EditProfileScreen;
