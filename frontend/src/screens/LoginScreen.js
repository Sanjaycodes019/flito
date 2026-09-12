import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { authService } from '../services/auth';
import { FLITO_COLORS } from '../utils/colors';
import { isValidPhone, getErrorMessage } from '../utils/helpers';
import { notify } from '../utils/alert';

const LoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('+977');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleSendOtp = async () => {
    if (!isValidPhone(phone)) {
      notify('Invalid phone', 'Enter a valid number as +977XXXXXXXXXX');
      return;
    }
    setLoading(true);
    try {
      const data = await authService.sendOtp(phone);
      setOtpSent(true);
      notify('OTP sent', data.otp ? `Dev OTP: ${data.otp}` : 'Check your phone for the code');
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!otp) {
      notify('Missing OTP', 'Enter the OTP sent to your phone');
      return;
    }
    setLoading(true);
    dispatch(loginStart());
    try {
      const data = await authService.login(phone, otp);
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      notify('Login failed', getErrorMessage(error));
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>FLITO</Text>
        <Text style={styles.subtitle}>Freight & Load Interchange</Text>
      </View>

      <Card>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="+9779841234567"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!otpSent}
        />

        {!otpSent ? (
          <Button title="Send OTP" onPress={handleSendOtp} loading={loading} />
        ) : (
          <>
            <Text style={styles.label}>Enter OTP</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button title="Login" onPress={handleLogin} loading={loading} />
            <Button
              title="Send OTP Again"
              variant="outline"
              onPress={() => { setOtpSent(false); setOtp(''); }}
            />
          </>
        )}

        <Button
          title="Create Account"
          variant="secondary"
          onPress={() => navigation.navigate('Signup')}
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginVertical: 32 },
  title: { fontSize: 32, fontWeight: 'bold', color: FLITO_COLORS.primary },
  subtitle: { fontSize: 14, color: FLITO_COLORS.textMuted, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', color: FLITO_COLORS.secondary, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 14,
  },
});

export default LoginScreen;
