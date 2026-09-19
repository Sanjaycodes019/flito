import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Input, { InputAction } from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import { colors, spacing } from '../theme/tokens';
import { authService } from '../services/auth';
import { isValidEmail, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

// Admin-only entry. The server rejects anyone who is not an admin holding the
// access key, and answers every failure the same way.
const AdminAccessScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';
  const canSubmit =
    isValidEmail(email) && password.length > 0 && accessKey.length > 0 && (!isSignup || firstName.trim().length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    dispatch(loginStart());
    try {
      const data = isSignup
        ? await authService.adminSignup({
            email: email.trim().toLowerCase(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            accessKey,
          })
        : await authService.adminLogin(email.trim().toLowerCase(), password, accessKey);
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify(t('auth:admin.failedTitle'), getErrorMessage(error));
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      title={t(isSignup ? 'auth:admin.signupTitle' : 'auth:admin.loginTitle')}
      subtitle={t('auth:admin.subtitle')}
    >
      {isSignup && (
        <>
          <Input label={t('auth:admin.firstName')} value={firstName} onChangeText={setFirstName} icon="user" required />
          <Input label={t('auth:admin.lastName')} value={lastName} onChangeText={setLastName} icon="user" />
        </>
      )}
      <Input
        label={t('auth:shared.emailLabel')}
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth:shared.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        icon="email"
        required
      />
      <Input
        label={t('auth:shared.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="current-password"
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
      <Input
        label={t('auth:admin.accessKey')}
        value={accessKey}
        onChangeText={setAccessKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        icon="lock"
        required
        onSubmitEditing={submit}
      />

      <Button
        title={t(isSignup ? 'auth:admin.signupButton' : 'auth:admin.loginButton')}
        icon="checkmark"
        onPress={submit}
        loading={loading}
        disabled={!canSubmit}
        style={styles.submit}
      />

      <View style={styles.switchRow}>
        <Button
          title={t(isSignup ? 'auth:admin.haveAccount' : 'auth:admin.needAccount')}
          variant="tertiary"
          onPress={() => setMode(isSignup ? 'login' : 'signup')}
        />
        <Button title={t('auth:admin.back')} variant="ghost" size="sm" onPress={() => navigation.navigate('Login')} />
      </View>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  submit: { marginTop: spacing.md },
  switchRow: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
});

export default AdminAccessScreen;
