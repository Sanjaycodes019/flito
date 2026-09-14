import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
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

// Mirrors the server: a verified name must keep matching the KYC documents.
const NAME_LOCKED_KYC_STATUSES = ['pending', 'approved'];

const EditProfileScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const [account, setAccount] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

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
          street: user.address?.street || '',
          city: user.address?.city || '',
        });
      } catch (error) {
        notify('Error', getErrorMessage(error));
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
      address: { street: form.street, city: form.city },
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
      notify('Could not save', getErrorMessage(error));
    }
    setSaving(false);

    if (saved) notify('Profile updated', 'Your changes have been saved', () => navigation.goBack());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <Input
          label="First Name"
          value={form.firstName}
          onChangeText={update('firstName')}
          editable={!namesLocked}
          icon="person"
        />
        <Input
          label="Last Name"
          value={form.lastName}
          onChangeText={update('lastName')}
          editable={!namesLocked}
          icon="person"
        />
        {namesLocked && (
          <View style={styles.lockNote}>
            <Icon name="lock" size={iconSize.xs} color={colors.textMuted} style={styles.lockIcon} />
            <Text style={styles.note}>
              Your name is matched to your identity documents, so it can&apos;t be changed while they are under review or approved.
            </Text>
          </View>
        )}

        <View style={styles.labelRow}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.verifiedPill, account.emailVerified ? styles.verifiedPillOn : styles.verifiedPillOff]}>
            <Icon name={account.emailVerified ? 'verified' : 'unverified'} size={12} color={account.emailVerified ? colors.successText : colors.warningText} />
            <Text style={[styles.verifiedPillText, { color: account.emailVerified ? colors.successText : colors.warningText }]}>
              {account.emailVerified ? 'Verified' : 'Not verified'}
            </Text>
          </View>
        </View>
        <Input
          value={form.email}
          onChangeText={update('email')}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          icon="email"
          editable={!account.hasGoogle}
          helperText={
            account.hasGoogle
              ? 'Managed by your Google account.'
              : account.hasPassword
                ? 'Changing this re-verifies your email.'
                : undefined
          }
        />

        <Input
          label="Phone Number"
          value={form.phone}
          onChangeText={update('phone')}
          placeholder="+9779841234567 (optional)"
          keyboardType="phone-pad"
          icon="phone"
        />

        {isOwner && (
          <Input
            label="Company Name"
            value={form.companyName}
            onChangeText={update('companyName')}
            placeholder="Optional"
            icon="owner"
          />
        )}

        <Input label="Street" value={form.street} onChangeText={update('street')} placeholder="Optional" icon="location" />
        <Input label="City" value={form.city} onChangeText={update('city')} placeholder="Optional" icon="location" />

        <View style={styles.readOnlyRow}>
          <Icon name={account.role === 'owner' ? 'owner' : account.role === 'driver' ? 'driver' : 'shipper'} size={iconSize.xs} color={colors.textMuted} style={styles.lockIcon} />
          <Text style={styles.readOnly}>{account.role} account</Text>
        </View>

        <Button title="Save Changes" icon="checkmark" onPress={handleSave} loading={saving} />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
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
