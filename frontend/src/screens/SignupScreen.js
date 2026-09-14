import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input, { InputAction } from '../components/common/Input';
import GoogleButton from '../components/auth/GoogleButton';
import PasswordStrengthMeter, { passwordScore } from '../components/auth/PasswordStrengthMeter';
import { useGoogleAuth, isGoogleConfigured } from '../hooks/useGoogleAuth';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { authService } from '../services/auth';
import { ROLES } from '../utils/constants';
import { isValidEmail, isValidPhone, getErrorMessage } from '../utils/helpers';
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
    <Icon name={option.icon} size={iconSize.lg} color={selected ? colors.primaryText : colors.textMuted} />
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
  const [role, setRole] = useState(ROLES.SHIPPER);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const dispatch = useDispatch();

  const nameError = nameTouched && !firstName.trim() ? 'First name is required' : null;
  const emailError = emailTouched && !isValidEmail(email) ? 'Enter a valid email address' : null;
  const phoneError = phoneTouched && phone.trim() && !isValidPhone(phone) ? 'Enter a valid number as +977XXXXXXXXXX' : null;
  const passwordsMatch = !confirmPassword || password === confirmPassword;

  const canSubmit = firstName.trim()
    && isValidEmail(email)
    && passwordScore(password) >= 2
    && password === confirmPassword
    && (!phone.trim() || isValidPhone(phone));

  const handleSignup = async () => {
    setNameTouched(true);
    setEmailTouched(true);
    setPhoneTouched(true);
    if (!canSubmit) return;

    setLoading(true);
    dispatch(loginStart());
    try {
      const data = await authService.signup({
        email: email.trim().toLowerCase(),
        password,
        role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      });
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify('Could not create account', getErrorMessage(error));
    }
    setLoading(false);
  };

  const handleGoogleResult = async (idToken, error) => {
    if (!idToken) {
      setGoogleLoading(false);
      if (error === 'not_configured') {
        notify('Not available yet', 'Google sign-in has not been configured for this app yet. Use email and password instead.');
      } else if (error) {
        notify('Google sign-in failed', error);
      }
      return;
    }
    try {
      const data = await authService.googleAuth(idToken, role);
      dispatch(loginSuccess(data));
    } catch (err) {
      notify('Google sign-in failed', getErrorMessage(err));
    }
    setGoogleLoading(false);
  };

  const { promptGoogleSignIn } = useGoogleAuth(handleGoogleResult);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join FLITO to book or offer truck capacity</Text>
        </View>

        <Card>
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
            label="Email"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            icon="email"
            error={emailError}
            required
          />
          <Input
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            onBlur={() => setPhoneTouched(true)}
            placeholder="+9779841234567 (optional)"
            keyboardType="phone-pad"
            icon="phone"
            error={phoneError}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            icon="lock"
            required
            rightElement={
              <InputAction
                icon={showPassword ? 'eyeOff' : 'eye'}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              />
            }
          />
          <PasswordStrengthMeter password={password} />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Type your password again"
            secureTextEntry={!showPassword}
            icon="lock"
            required
            error={!passwordsMatch ? 'Passwords do not match' : null}
          />

          <Text style={styles.terms}>
            By continuing, you agree to FLITO&apos;s Terms of Service and Privacy Policy.
          </Text>

          <Button title="Create Account" icon="checkmark" onPress={handleSignup} loading={loading} disabled={!canSubmit} />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Never disabled: an unconfigured client still answers the tap with
              a clear "not available yet" message instead of a dead click. */}
          <GoogleButton
            title="Sign up with Google"
            onPress={() => { setGoogleLoading(isGoogleConfigured()); promptGoogleSignIn(); }}
            loading={googleLoading}
          />

          <View style={styles.spacer} />
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
  logo: { width: 56, height: 56, marginBottom: spacing.sm },
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
  roleCardSelected: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  roleLabel: { ...type.smallMedium, color: colors.textPrimary, marginTop: spacing.xs, textAlign: 'center' },
  roleLabelSelected: { color: colors.primaryText },
  roleDesc: { ...type.small, fontSize: 10, lineHeight: 13, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  roleCheck: { position: 'absolute', top: 6, right: 6 },
  terms: { ...type.small, color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { ...type.small, color: colors.textMuted, marginHorizontal: spacing.sm },
  spacer: { height: spacing.md },
});

export default SignupScreen;
