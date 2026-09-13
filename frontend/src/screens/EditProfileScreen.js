import React, { useEffect, useState } from 'react';
import { Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { FLITO_COLORS } from '../utils/colors';
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
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={[styles.input, namesLocked && styles.inputLocked]}
          value={form.firstName}
          onChangeText={update('firstName')}
          editable={!namesLocked}
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={[styles.input, namesLocked && styles.inputLocked]}
          value={form.lastName}
          onChangeText={update('lastName')}
          editable={!namesLocked}
        />
        {namesLocked && (
          <Text style={styles.note}>
            Your name is matched to your identity documents, so it can't be changed while they are under review or approved.
          </Text>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={form.email}
          onChangeText={update('email')}
          placeholder="Optional"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {isOwner && (
          <>
            <Text style={styles.label}>Company Name</Text>
            <TextInput style={styles.input} value={form.companyName} onChangeText={update('companyName')} placeholder="Optional" />
          </>
        )}

        <Text style={styles.label}>Street</Text>
        <TextInput style={styles.input} value={form.street} onChangeText={update('street')} placeholder="Optional" />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={form.city} onChangeText={update('city')} placeholder="Optional" />

        <Text style={styles.readOnly}>Phone {account.phone} · {account.role}</Text>

        <Button title="Save Changes" onPress={handleSave} loading={saving} />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: FLITO_COLORS.secondary, marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  inputLocked: { backgroundColor: FLITO_COLORS.background, color: FLITO_COLORS.textMuted },
  note: { fontSize: 12, color: FLITO_COLORS.textMuted, marginBottom: 8 },
  readOnly: { fontSize: 12, color: FLITO_COLORS.textMuted, marginVertical: 12, textTransform: 'capitalize' },
});

export default EditProfileScreen;
