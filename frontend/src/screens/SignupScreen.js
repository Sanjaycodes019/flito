import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Input, { InputAction } from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import GoogleButton from '../components/auth/GoogleButton';
import GoogleIcon from '../components/auth/GoogleIcon';
import PasswordStrengthMeter, { passwordScore } from '../components/auth/PasswordStrengthMeter';
import OtpInput from '../components/auth/OtpInput';
import { useGoogleAuth, isGoogleConfigured } from '../hooks/useGoogleAuth';
import useBreakpoint from '../hooks/useBreakpoint';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../theme/tokens';
import { authService } from '../services/auth';
import { ROLES } from '../utils/constants';
import { isValidEmail, isValidPhone, getErrorMessage, pinProblemKey, toNepalPhone } from '../utils/helpers';
import { notify } from '../utils/alert';

const getRoleOptions = (t) => [
  { value: ROLES.SHIPPER, label: t('auth:signup.roleShipperLabel'), desc: t('auth:signup.roleShipperDesc'), icon: 'load' },
  { value: ROLES.OWNER, label: t('auth:signup.roleOwnerLabel'), desc: t('auth:signup.roleOwnerDesc'), icon: 'fleet' },
  { value: ROLES.DRIVER, label: t('auth:signup.roleDriverLabel'), desc: t('auth:signup.roleDriverDesc'), icon: 'driver' },
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

// Required before any account is created, by email or by Google.
const TermsCheckbox = ({ checked, onToggle }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      // react-native-web does not turn accessibilityState.checked into
      // aria-checked, so browsers' screen readers need it set directly.
      aria-checked={checked}
      accessibilityLabel={t('auth:signup.termsAccessibilityLabel')}
      hitSlop={4}
      style={styles.termsRow}
    >
      <Icon
        name={checked ? 'checkboxOn' : 'checkboxOff'}
        size={iconSize.md}
        color={checked ? colors.primaryText : colors.textMuted}
      />
      <Text style={styles.termsText}>
        {t('auth:signup.termsPrefix')}<Text style={styles.termsStrong}>{t('auth:signup.termsOfService')}</Text>{t('auth:signup.termsAnd')}
        <Text style={styles.termsStrong}>{t('auth:signup.privacyPolicy')}</Text>{t('auth:signup.termsSuffix')}
      </Text>
    </Pressable>
  );
};

// Three ways in:
// - A normal visit: phone number + 4-digit PIN (the default, since most users
//   have no email), email/password, or "Sign up with Google".
// - Arriving from the login page's Google button when no FLITO account
//   exists yet. The Google token is already verified, so the screen only
//   asks for a role and finishes the sign up with it (no second popup).
const SignupScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { width, isPhone } = useBreakpoint();
  const stackRoles = width < STACK_ROLES_BELOW;
  const ROLE_OPTIONS = getRoleOptions(t);

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
  const [agreed, setAgreed] = useState(false);
  // 'phone' (number + PIN) or 'email' (email + password).
  const [mode, setMode] = useState('phone');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [phoneTried, setPhoneTried] = useState(false);
  const dispatch = useDispatch();

  const fullPhone = toNepalPhone(phone);
  const pinKey = pinProblemKey(pin);
  // What still stands between a phone sign up and the account, first problem first.
  const phoneFormProblem = (() => {
    if (!firstName.trim()) return t('auth:signup.nameRequiredError');
    if (!isValidPhone(fullPhone)) return t('auth:phoneSignup.phoneError');
    if (pinKey) return t(`auth:pinRules.${pinKey}`);
    if (pin !== confirmPin) return t('auth:pinRules.mismatch');
    if (!agreed) return t('auth:phoneSignup.agreeFirst');
    return null;
  })();

  const handlePhoneSignup = async () => {
    setPhoneTried(true);
    if (phoneFormProblem) return;
    setLoading(true);
    dispatch(loginStart());
    try {
      dispatch(loginSuccess(await authService.signupPhone({
        role, firstName: firstName.trim(), lastName: lastName.trim(), phone: fullPhone, pin,
      })));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify(t('auth:signup.couldNotSignUpTitle'), getErrorMessage(error));
      setLoading(false);
    }
  };

  const nameError = nameTouched && !firstName.trim() ? t('auth:signup.nameRequiredError') : null;
  const emailError = emailTouched && !isValidEmail(email) ? t('auth:shared.invalidEmail') : null;
  const phoneError = phoneTouched && phone.trim() && !isValidPhone(phone) ? t('auth:signup.phoneInvalidError') : null;
  const passwordsMatch = !confirmPassword || password === confirmPassword;

  const canSubmit = firstName.trim()
    && isValidEmail(email)
    && passwordScore(password) >= 2
    && password === confirmPassword
    && (!phone.trim() || isValidPhone(phone))
    && agreed;

  // A disabled Sign Up button on its own does not say why, so the form
  // spells out what is still missing once the user has started filling it in.
  const missing = [];
  if (!firstName.trim()) missing.push(t('auth:signup.missingFirstName'));
  if (!isValidEmail(email)) missing.push(t('auth:signup.missingEmail'));
  if (passwordScore(password) < 2) missing.push(t('auth:signup.missingPasswordRequirements'));
  else if (password !== confirmPassword) missing.push(t('auth:signup.missingPasswordMatch'));
  if (phone.trim() && !isValidPhone(phone)) missing.push(t('auth:signup.missingPhone'));
  if (!agreed) missing.push(t('auth:signup.missingTerms'));
  const started = Boolean(firstName || lastName || email || phone || password || confirmPassword || agreed);

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
      // The account exists either way; the code can be sent again from Home.
      if (data.verificationEmailSent === false) {
        notify(t('auth:signup.accountCreatedTitle'), t('auth:signup.accountCreatedEmailFailedMessage'));
      }
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify(t('auth:signup.couldNotSignUpTitle'), getErrorMessage(error));
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
        notify(t('auth:signup.welcomeBackTitle'), t('auth:signup.welcomeBackMessage'), () => dispatch(loginSuccess(data)));
      } else {
        dispatch(loginSuccess(data));
      }
    } catch (err) {
      setPendingGoogle(null);
      notify(t('auth:signup.googleSignUpFailedTitle'), t('auth:signup.googleSignUpFailedRetryMessage', { error: getErrorMessage(err) }));
      setGoogleLoading(false);
    }
  };

  const handleGoogleResult = async (idToken, error) => {
    if (!idToken) {
      setGoogleLoading(false);
      if (error === 'not_configured') {
        notify(t('auth:google.notConfiguredTitle'), t('auth:google.notConfiguredMessage'));
      } else if (error) {
        notify(t('auth:signup.googleSignUpFailedTitle'), error);
      }
      return;
    }
    await completeGoogleSignup(idToken);
  };

  const { promptGoogleSignIn } = useGoogleAuth(handleGoogleResult);

  // The Google button stays tappable (see below), so the Terms check happens
  // here instead of by disabling it.
  const startGoogleSignup = () => {
    if (!agreed) {
      notify(t('auth:signup.agreeToTermsFirstTitle'), t('auth:signup.agreeToTermsFirstMessage'));
      return;
    }
    setGoogleLoading(isGoogleConfigured());
    promptGoogleSignIn();
  };

  const googleName = [pendingGoogle?.profile?.firstName, pendingGoogle?.profile?.lastName].filter(Boolean).join(' ');

  const rolePicker = (
    <>
      <Text style={styles.sectionLabel}>{t('auth:signup.roleSectionLabel')}</Text>
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
      title={t('auth:shared.signUp')}
      subtitle={pendingGoogle ? t('auth:signup.subtitlePending') : t('auth:signup.subtitleNew')}
      maxWidth={pendingGoogle ? 480 : 560}
    >
      {pendingGoogle ? (
        <>
          <View style={styles.googleBanner}>
            <GoogleIcon size={22} />
            <View style={styles.googleBannerText}>
              <Text style={styles.googleBannerTitle}>{t('auth:signup.googleBannerTitle')}</Text>
              <Text style={styles.googleBannerBody}>
                {t('auth:signup.googleBannerPrefix')}
                <Text style={styles.googleBannerEmail}>{pendingGoogle.profile.email || t('auth:signup.googleAccountFallback')}</Text>
                {googleName ? ` (${googleName})` : ''}{t('auth:signup.googleBannerSuffix')}
              </Text>
            </View>
          </View>

          {rolePicker}

          <TermsCheckbox checked={agreed} onToggle={() => setAgreed((v) => !v)} />

          <Button
            title={t('auth:signup.finishSignUp')}
            icon="checkmark"
            onPress={() => completeGoogleSignup(pendingGoogle.idToken)}
            loading={googleLoading}
            disabled={!agreed}
          />
          <Button title={t('auth:signup.useEmailInstead')} variant="ghost" onPress={() => { setPendingGoogle(null); setMode('email'); }} />
        </>
      ) : mode === 'phone' ? (
        <>
          {rolePicker}

          <View style={isPhone ? null : styles.fieldRow}>
            <Input
              label={t('auth:signup.firstNameLabel')}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('auth:signup.firstNamePlaceholder')}
              autoComplete="given-name"
              icon="person"
              required
              containerStyle={isPhone ? undefined : styles.fieldHalf}
            />
            <Input
              label={t('auth:signup.lastNameLabel')}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('auth:signup.lastNamePlaceholder')}
              autoComplete="family-name"
              icon="person"
              containerStyle={isPhone ? undefined : styles.fieldHalf}
            />
          </View>

          <Input
            label={t('auth:phoneSignup.phoneLabel')}
            value={phone}
            onChangeText={setPhone}
            placeholder="98XXXXXXXX"
            keyboardType="phone-pad"
            autoComplete="tel"
            icon="phone"
            helperText={t('auth:phoneSignup.phoneHelp')}
            required
          />

          <Text style={styles.sectionLabel}>{t('auth:phoneSignup.pinLabel')}</Text>
          <OtpInput length={4} value={pin} onChange={setPin} autoFocus={false} />
          <Text style={styles.pinHint}>{t('auth:phoneSignup.pinHint')}</Text>
          <Text style={styles.sectionLabel}>{t('auth:phoneSignup.confirmPinLabel')}</Text>
          <OtpInput length={4} value={confirmPin} onChange={setConfirmPin} autoFocus={false} />

          <View style={styles.pinGap} />
          <TermsCheckbox checked={agreed} onToggle={() => setAgreed((v) => !v)} />

          {/* Never greyed out: a tap on an unfinished form says what is missing. */}
          <Button title={t('auth:shared.signUp')} icon="checkmark" size="lg" onPress={handlePhoneSignup} loading={loading} />
          {phoneTried && phoneFormProblem ? <Text style={styles.problem}>{phoneFormProblem}</Text> : null}

          <Button title={t('auth:phoneSignup.useEmail')} variant="ghost" size="sm" onPress={() => setMode('email')} style={styles.modeSwitch} />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth:shared.or')}</Text>
            <View style={styles.dividerLine} />
          </View>
          <GoogleButton title={t('auth:signup.googleButtonTitle')} onPress={startGoogleSignup} loading={googleLoading} />
        </>
      ) : (
        <>
          {rolePicker}

          {/* First and last name share a row from tablet width up. */}
          <View style={isPhone ? null : styles.fieldRow}>
            <Input
              label={t('auth:signup.firstNameLabel')}
              value={firstName}
              onChangeText={setFirstName}
              onBlur={() => setNameTouched(true)}
              placeholder={t('auth:signup.firstNamePlaceholder')}
              autoComplete="given-name"
              icon="person"
              error={nameError}
              required
              containerStyle={isPhone ? undefined : styles.fieldHalf}
            />
            <Input
              label={t('auth:signup.lastNameLabel')}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('auth:signup.lastNamePlaceholder')}
              autoComplete="family-name"
              icon="person"
              containerStyle={isPhone ? undefined : styles.fieldHalf}
            />
          </View>

          <Input
            label={t('auth:shared.emailLabel')}
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            placeholder={t('auth:shared.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            icon="email"
            error={emailError}
            required
          />
          <Input
            label={t('auth:signup.phoneLabel')}
            value={phone}
            onChangeText={setPhone}
            onBlur={() => setPhoneTouched(true)}
            placeholder={t('auth:signup.phonePlaceholder')}
            keyboardType="phone-pad"
            autoComplete="tel"
            icon="phone"
            error={phoneError}
          />

          <Input
            label={t('auth:shared.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth:shared.passwordPlaceholderMin8')}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            icon="lock"
            required
            rightElement={
              <InputAction
                icon={showPassword ? 'eyeOff' : 'eye'}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? t('auth:shared.hidePassword') : t('auth:shared.showPassword')}
              />
            }
          />
          <PasswordStrengthMeter password={password} />

          <Input
            label={t('auth:signup.confirmPasswordLabel')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('auth:signup.confirmPasswordPlaceholder')}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            icon="lock"
            required
            error={!passwordsMatch ? t('auth:shared.passwordsMismatch') : null}
          />

          <TermsCheckbox checked={agreed} onToggle={() => setAgreed((v) => !v)} />

          <Button title={t('auth:shared.signUp')} icon="checkmark" onPress={handleSignup} loading={loading} disabled={!canSubmit} />
          {started && missing.length > 0 && (
            <Text style={styles.missingHint}>{t('auth:signup.missingHint', { items: missing.join(', ') })}</Text>
          )}
          <Button title={t('auth:phoneSignup.usePhone')} variant="ghost" size="sm" onPress={() => setMode('phone')} style={styles.modeSwitch} />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth:shared.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Never disabled: an unconfigured client still answers the tap with
              a clear "not available yet" message instead of a dead click. */}
          <GoogleButton
            title={t('auth:signup.googleButtonTitle')}
            onPress={startGoogleSignup}
            loading={googleLoading}
          />
        </>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchPrompt}>{t('auth:signup.hasAccountPrompt')}</Text>
        <Button title={t('auth:shared.logIn')} variant="tertiary" onPress={() => navigation.navigate('Login')} />
      </View>
    </AuthLayout>
  );
};

const styles = themedStyles(() => ({
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
  roleDesc: { ...type.caption, fontWeight: '400', color: colors.textMuted, textAlign: 'center', marginTop: 2 },
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
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
  termsText: { ...type.small, color: colors.textSecondary, flex: 1, paddingTop: 2 },
  termsStrong: { fontWeight: '600', color: colors.textPrimary },
  pinHint: { ...type.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  pinGap: { height: spacing.lg },
  problem: { ...type.small, color: colors.errorText, textAlign: 'center', marginTop: spacing.sm },
  modeSwitch: { alignSelf: 'center', marginTop: spacing.sm },
  missingHint: { ...type.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { ...type.small, color: colors.textMuted, marginHorizontal: spacing.sm },
  switchRow: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  switchPrompt: { ...type.small, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xs },
}));

export default SignupScreen;
