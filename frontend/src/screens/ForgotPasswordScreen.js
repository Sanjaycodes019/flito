import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize } from '../theme/tokens';
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Icon name="lock" size={iconSize.xl} color={colors.primaryText} />
          </View>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter the email on your account and we&apos;ll send a code to reset your password.
          </Text>
        </View>

        <Card>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(true)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            icon="email"
            error={emailError}
            required
          />
          <Button title="Send Reset Code" icon="send" onPress={handleSubmit} loading={loading} disabled={!isValidEmail(email)} />
          <Button title="Back to Login" variant="ghost" onPress={() => navigation.navigate('Login')} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginVertical: spacing.xxl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...type.h1, color: colors.secondary },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});

export default ForgotPasswordScreen;
