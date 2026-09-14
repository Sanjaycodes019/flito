import React, { useState } from 'react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import AuthLayout from '../components/auth/AuthLayout';
import { authService } from '../services/auth';
import { isValidEmail, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailError = touched && !isValidEmail(email) ? 'Enter a valid email address' : null;

  const handleSubmit = async () => {
    if (!isValidEmail(email)) {
      setTouched(true);
      return;
    }
    setLoading(true);
    try {
      const data = await authService.forgotPassword(email.trim().toLowerCase());
      if (data.resetCode) notify('Dev mode', `Reset code for testing: ${data.resetCode}`);
      navigation.replace('ResetPassword', { email: email.trim().toLowerCase() });
    } catch (error) {
      notify('Something went wrong', getErrorMessage(error));
    }
    setLoading(false);
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter the email on your account and we'll send a code to reset your password."
    >
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        onBlur={() => setTouched(true)}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        icon="email"
        error={emailError}
        required
        onSubmitEditing={handleSubmit}
      />
      <Button title="Send Reset Code" icon="send" onPress={handleSubmit} loading={loading} disabled={!isValidEmail(email)} />
      <Button title="Back to Login" variant="ghost" onPress={() => navigation.navigate('Login')} />
    </AuthLayout>
  );
};

export default ForgotPasswordScreen;
