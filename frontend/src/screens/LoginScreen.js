import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input, { InputAction } from '../components/common/Input';
import GoogleButton from '../components/auth/GoogleButton';
import { useGoogleAuth, isGoogleConfigured } from '../hooks/useGoogleAuth';
import { colors, spacing, type } from '../theme/tokens';
import { authService } from '../services/auth';
import { isValidEmail, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const dispatch = useDispatch();

  const emailError = emailTouched && !isValidEmail(email) ? 'Enter a valid email address' : null;
  const canSubmit = isValidEmail(email) && password.length > 0;

  const handleLogin = async () => {
    if (!canSubmit) {
      setEmailTouched(true);
      return;
    }
    setLoading(true);
    dispatch(loginStart());
    try {
      const data = await authService.login(email.trim().toLowerCase(), password);
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify('Login failed', getErrorMessage(error));
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
      const data = await authService.googleAuth(idToken);
      dispatch(loginSuccess(data));
    } catch (err) {
      if (err.response?.data?.code === 'ROLE_REQUIRED') {
        notify('No account yet', 'Create an account with Google from the signup page first, so we know what kind of account to make.');
      } else {
        notify('Google sign-in failed', getErrorMessage(err));
      }
    }
    setGoogleLoading(false);
  };

  const { promptGoogleSignIn } = useGoogleAuth(handleGoogleResult);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>FLITO</Text>
          <Text style={styles.subtitle}>Freight & Load Interchange</Text>
        </View>

        <Card>
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
            testID="login-email-input"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
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

          <Button
            title="Forgot password?"
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotButton}
          />

          <Button
            title="Log In"
            icon="checkmark"
            onPress={handleLogin}
            loading={loading}
            disabled={!canSubmit}
            style={styles.loginButton}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Never disabled: an unconfigured client still answers the tap with
              a clear "not available yet" message instead of a dead click. */}
          <GoogleButton
            onPress={() => { setGoogleLoading(isGoogleConfigured()); promptGoogleSignIn(); }}
            loading={googleLoading}
          />

          <View style={styles.spacer} />

          <Button
            title="Create Account"
            variant="tertiary"
            icon="add"
            onPress={() => navigation.navigate('Signup')}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginVertical: spacing.xxxl },
  logo: { width: 72, height: 72, marginBottom: spacing.md },
  title: { ...type.display, color: colors.primary, letterSpacing: 1 },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xs },
  forgotButton: { alignSelf: 'flex-end', marginTop: -spacing.sm },
  loginButton: { marginTop: spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  dividerText: { ...type.small, color: colors.textMuted, marginHorizontal: spacing.sm },
  spacer: { height: spacing.md },
});

export default LoginScreen;
