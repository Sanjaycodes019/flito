import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Input, { InputAction } from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import GoogleButton from '../components/auth/GoogleButton';
import GoogleIcon from '../components/auth/GoogleIcon';
import PasswordStrengthMeter, { passwordScore } from '../components/auth/PasswordStrengthMeter';
import { useGoogleAuth, isGoogleConfigured } from '../hooks/useGoogleAuth';
import useBreakpoint from '../hooks/useBreakpoint';
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

// Below this window width three role cards side by side get too cramped to
// read, so they stack as full-width rows instead.
const STACK_ROLES_BELOW = 360;

const RoleOption = ({ option, selected, onSelect, stacked }) => (
  <Pressable
    onPress={onSelect}
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    accessibilityLabel={`${option.label}, ${option.desc}`}
    style={[styles.roleCard, stacked && styles.roleCardStacked, selected && styles.roleCardSelected]}
  >
    <Icon name={option.icon} size={iconSize.lg} color={selected ? colors.primaryText : colors.textMuted} />
    <View style={stacked ? styles.roleTextStacked : styles.roleText}>
      <Text style={[styles.roleLabel, stacked && styles.roleLabelStacked, selected && styles.roleLabelSelected]}>{option.label}</Text>
      <Text style={[styles.roleDesc, stacked && styles.roleDescStacked]}>{option.desc}</Text>
    </View>
    {selected && (
      <View style={styles.roleCheck}>
        <Icon name="success" size={16} color={colors.primaryText} />
      </View>
    )}
  </Pressable>
);

// Two ways in:
// - A normal visit: email/password sign up, or "Sign up with Google".
// - Arriving from the login page's Google button when no FLITO account
//   exists yet. The Google token is already verified, so the screen only
//   asks for a role and finishes the sign up with it (no second popup).
const SignupScreen = ({ navigation, route }) => {
  const { width, isPhone } = useBreakpoint();
  const stackRoles = width < STACK_ROLES_BELOW;

  const [pendingGoogle, setPendingGoogle] = useState(() => (
    route?.params?.googleIdToken
      ? { idToken: route.params.googleIdToken, profile: route.params.googleProfile || {} }
      : null
  ));
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
      notify('Could not sign up', getErrorMessage(error));
    }
    setLoading(false);
  };

  // Shared by "Sign up with Google" and "Finish Sign Up". A Google account
  // that already has a FLITO account is simply logged in (the server ignores
  // the role), and says so, rather than failing as a duplicate.
  const completeGoogleSignup = async (idToken) => {
    setGoogleLoading(true);
    try {
      const data = await authService.googleAuth(idToken, role);
      if (data.isNewAccount === false) {
        notify('Welcome back', 'You already have a FLITO account with this Google account, so we logged you in.', () => dispatch(loginSuccess(data)));
      } else {
        dispatch(loginSuccess(data));
      }
    } catch (err) {
      setPendingGoogle(null);
      notify('Google sign up failed', `${getErrorMessage(err)} Tap "Sign up with Google" to try again.`);
      setGoogleLoading(false);
    }
  };

  const handleGoogleResult = async (idToken, error) => {
    if (!idToken) {
      setGoogleLoading(false);
      if (error === 'not_configured') {
        notify('Not available yet', 'Google sign-in has not been configured for this app yet. Use email and password instead.');
      } else if (error) {
        notify('Google sign up failed', error);
      }
      return;
    }
    await completeGoogleSignup(idToken);
  };

  const { promptGoogleSignIn } = useGoogleAuth(handleGoogleResult);

  const googleName = [pendingGoogle?.profile?.firstName, pendingGoogle?.profile?.lastName].filter(Boolean).join(' ');

  const rolePicker = (
    <>
      <Text style={styles.sectionLabel}>I am a...</Text>
      <View style={[styles.roleRow, stackRoles && styles.roleColumn]} accessibilityRole="radiogroup">
        {ROLE_OPTIONS.map((opt) => (
          <RoleOption
            key={opt.value}
            option={opt}
            selected={role === opt.value}
            onSelect={() => setRole(opt.value)}
            stacked={stackRoles}
          />
        ))}
      </View>
    </>
  );

  return (
    <AuthLayout
      title="Sign Up"
      subtitle={pendingGoogle ? 'One more step to finish your account' : 'Create your FLITO account'}
      maxWidth={pendingGoogle ? 480 : 560}
    >
      {pendingGoogle ? (
        <>
          <View style={styles.googleBanner}>
            <GoogleIcon size={22} />
            <View style={styles.googleBannerText}>
              <Text style={styles.googleBannerTitle}>No FLITO account yet</Text>
              <Text style={styles.googleBannerBody}>
                Signing up with Google as{' '}
                <Text style={styles.googleBannerEmail}>{pendingGoogle.profile.email || 'your Google account'}</Text>
                {googleName ? ` (${googleName})` : ''}. Choose what kind of account this is.
              </Text>
            </View>
          </View>

          {rolePicker}

          <Button
            title="Finish Sign Up"
            icon="checkmark"
            onPress={() => completeGoogleSignup(pendingGoogle.idToken)}
            loading={googleLoading}
          />
          <Button title="Use Email Instead" variant="ghost" onPress={() => setPendingGoogle(null)} />
        </>
      ) : (
        <>
          {rolePicker}

          {/* First and last name share a row from tablet width up. */}
          <View style={isPhone ? null : styles.fieldRow}>
            <Input
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              onBlur={() => setNameTouched(true)}
              placeholder="Ram"
              autoComplete="given-name"
              icon="person"
              error={nameError}
              required
              containerStyle={isPhone ? undefined : styles.fieldHalf}
            />
            <Input
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Shrestha"
              autoComplete="family-name"
              icon="person"
              containerStyle={isPhone ? undefined : styles.fieldHalf}
            />
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
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
            autoComplete="tel"
            icon="phone"
            error={phoneError}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            secureTextEntry={!showPassword}
            autoComplete="new-password"
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
            autoComplete="new-password"
            icon="lock"
            required
            error={!passwordsMatch ? 'Passwords do not match' : null}
          />

          <Text style={styles.terms}>
            By continuing, you agree to FLITO&apos;s Terms of Service and Privacy Policy.
          </Text>

          <Button title="Sign Up" icon="checkmark" onPress={handleSignup} loading={loading} disabled={!canSubmit} />

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
        </>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchPrompt}>Already have an account?</Text>
        <Button title="Log In" variant="tertiary" onPress={() => navigation.navigate('Login')} />
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  sectionLabel: { ...type.smallMedium, color: colors.textSecondary, marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  roleColumn: { flexDirection: 'column' },
  roleCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  roleCardStacked: {
    flex: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  roleCardSelected: { borderColor: colors.primaryText, backgroundColor: colors.primaryMuted },
  roleText: { alignItems: 'center' },
  roleTextStacked: { flex: 1, alignItems: 'flex-start' },
  roleLabel: { ...type.smallMedium, color: colors.textPrimary, marginTop: spacing.xs, textAlign: 'center' },
  roleLabelStacked: { marginTop: 0, textAlign: 'left' },
  roleLabelSelected: { color: colors.primaryText },
  roleDesc: { ...type.small, fontSize: 11, lineHeight: 14, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  roleDescStacked: { textAlign: 'left' },
  roleCheck: { position: 'absolute', top: 6, right: 6 },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  fieldHalf: { flex: 1 },
  googleBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  googleBannerText: { flex: 1 },
  googleBannerTitle: { ...type.bodyMedium, color: colors.textPrimary },
  googleBannerBody: { ...type.small, color: colors.textSecondary, marginTop: spacing.xxs },
  googleBannerEmail: { fontWeight: '700', color: colors.textPrimary },
  terms: { ...type.small, color: colors.textMuted, marginBottom: spacing.md, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { ...type.small, color: colors.textMuted, marginHorizontal: spacing.sm },
  switchRow: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  switchPrompt: { ...type.small, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xs },
});

export default SignupScreen;
