import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import { authService } from '../services/auth';
import { isValidEmail, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const ForgotPasswordScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailError = touched && !isValidEmail(email) ? t('auth:shared.invalidEmail') : null;

  const handleSubmit = async () => {
    if (!isValidEmail(email)) {
      setTouched(true);
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      navigation.replace('ResetPassword', { email: email.trim().toLowerCase() });
    } catch (error) {
      notify(t('auth:forgotPassword.genericErrorTitle'), getErrorMessage(error));
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      title={t('auth:forgotPassword.title')}
      subtitle={t('auth:forgotPassword.subtitle')}
    >
      <Input
        label={t('auth:shared.emailLabel')}
        value={email}
        onChangeText={setEmail}
        onBlur={() => setTouched(true)}
        placeholder={t('auth:shared.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        icon="email"
        error={emailError}
        required
        onSubmitEditing={handleSubmit}
      />
      <Button title={t('auth:forgotPassword.submit')} icon="send" onPress={handleSubmit} loading={loading} disabled={!isValidEmail(email)} />
      <Button title={t('auth:shared.backToLogin')} variant="ghost" onPress={() => navigation.navigate('Login')} />
    </AuthLayout>
  );
};

export default ForgotPasswordScreen;
