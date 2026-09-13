import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import OtpInput from '../components/auth/OtpInput';
import ResendCode from '../components/auth/ResendCode';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { authService } from '../services/auth';
import { ROLES } from '../utils/constants';
import { isValidPhone, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const ROLE_OPTIONS = [
  { value: ROLES.SHIPPER, label: 'Shipper', desc: 'I need to move goods', icon: 'load' },
  { value: ROLES.OWNER, label: 'Truck Owner', desc: 'I have trucks to offer', icon: 'fleet' },
  { value: ROLES.DRIVER, label: 'Driver', desc: 'I drive for an owner', icon: 'driver' },
];

const RoleOption = ({ option, selected, onSelect }) => (
  <Pressable
    onPress={onSelect}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    accessibilityLabel={`${option.label}, ${option.desc}`}
    style={[styles.roleCard, selected && styles.roleCardSelected]}
  >
    <Icon name={option.icon} size={iconSize.lg} color={selected ? colors.primary : colors.textMuted} />
    <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>{option.label}</Text>
    <Text style={styles.roleDesc}>{option.desc}</Text>
    {selected && (
      <View style={styles.roleCheck}>
        <Icon name="success" size={16} color={colors.primaryText} />
      </View>
    )}
  </Pressable>
);

const SignupScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('+977');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [role, setRole] = useState(ROLES.SHIPPER);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sentAt, setSentAt] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [creating, setCreating] = useState(false);
  const dispatch = useDispatch();

  const phoneError = phoneTouched && !isValidPhone(phone) ? 'Enter a valid number as +977XXXXXXXXXX' : null;
  const nameError = nameTouched && !firstName.trim() ? 'First name is required' : null;
  const canSendOtp = isValidPhone(phone) && !!firstName.trim() && !sendingOtp;

  const sendOtp = async () => {
    setPhoneTouched(true);
    setNameTouched(true);
    if (!isValidPhone(phone) || !firstName.trim()) return;
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

  const handleSignup = async () => {
    if (otp.length < 6) return;
    setCreating(true);
    dispatch(loginStart());
    try {
      const data = await authService.signup({ phone, otp, role, firstName, lastName });
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify('Could not create account', getErrorMessage(error));
      setOtp('');
    }
    setCreating(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join FLITO to book or offer truck capacity</Text>
        </View>

        <Card>
          {!otpSent ? (
            <>
              <Text style={styles.sectionLabel}>I am a...</Text>
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((opt) => (
                  <RoleOption key={opt.value} option={opt} selected={role === opt.value} onSelect={() => setRole(opt.value)} />
                ))}
              </View>

              <Input
                label="First Name"
                value={firstName}
                onChangeText={setFirstName}
                onBlur={() => setNameTouched(true)}
                placeholder="Ram"
                icon="person"
                error={nameError}
                required
              />
              <Input
                label="Last Name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Shrestha"
                icon="person"
              />
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
              />

              <Text style={styles.terms}>
                By continuing, you agree to FLITO&apos;s Terms of Service and Privacy Policy.
              </Text>

              <Button title="Send OTP" icon="send" onPress={sendOtp} loading={sendingOtp} disabled={!canSendOtp} />
            </>
          ) : (
            <>
              <Text style={styles.otpPrompt}>
                Enter the 6-digit code sent to <Text style={styles.otpPhone}>{phone}</Text>
              </Text>
              <View style={styles.otpWrap}>
                <OtpInput value={otp} onChange={setOtp} editable={!creating} />
              </View>
              <ResendCode sentAt={sentAt} onResend={sendOtp} disabled={sendingOtp} />

              <Button
                title="Create Account"
                icon="checkmark"
                onPress={handleSignup}
                loading={creating}
                disabled={otp.length < 6}
                style={styles.createButton}
              />
              <Button title="Edit Details" variant="ghost" onPress={() => { setOtpSent(false); setOtp(''); setSentAt(null); }} />
            </>
          )}

          <View style={styles.divider} />
          <Button title="Back to Login" variant="tertiary" onPress={() => navigation.navigate('Login')} />
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
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  sectionLabel: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  roleCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  roleLabel: { ...type.smallMedium, color: colors.textPrimary, marginTop: spacing.xs, textAlign: 'center' },
  roleLabelSelected: { color: colors.primaryText },
  roleDesc: { ...type.small, fontSize: 10, lineHeight: 13, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  roleCheck: { position: 'absolute', top: 6, right: 6 },
  terms: { ...type.small, color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center' },
  otpPrompt: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  otpPhone: { fontWeight: '700', color: colors.textPrimary },
  otpWrap: { marginBottom: spacing.sm },
  createButton: { marginTop: spacing.md },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
});

export default SignupScreen;
