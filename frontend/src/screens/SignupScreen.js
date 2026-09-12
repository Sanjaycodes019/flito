import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ScrollView, Alert, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginError } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { authService } from '../services/auth';
import { FLITO_COLORS } from '../utils/colors';
import { ROLES } from '../utils/constants';
import { isValidPhone, getErrorMessage } from '../utils/helpers';

const ROLE_OPTIONS = [
  { label: 'Shipper', value: ROLES.SHIPPER, desc: 'I need to move goods' },
  { label: 'Truck Owner', value: ROLES.OWNER, desc: 'I have trucks to offer' },
  { label: 'Driver', value: ROLES.DRIVER, desc: 'I drive for an owner' },
];

const SignupScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('+977');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState(ROLES.SHIPPER);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleSendOtp = async () => {
    if (!isValidPhone(phone)) {
      Alert.alert('Invalid phone', 'Enter a valid number as +977XXXXXXXXXX');
      return;
    }
    if (!firstName) {
      Alert.alert('Missing name', 'Enter your first name');
      return;
    }
    setLoading(true);
    try {
      const data = await authService.sendOtp(phone);
      setOtpSent(true);
      Alert.alert('OTP sent', data.otp ? `Dev OTP: ${data.otp}` : 'Check your phone for the code');
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!otp) {
      Alert.alert('Missing OTP', 'Enter the OTP sent to your phone');
      return;
    }
    setLoading(true);
    dispatch(loginStart());
    try {
      const data = await authService.signup({ phone, otp, role, firstName, lastName });
      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginError(getErrorMessage(error)));
      Alert.alert('Signup failed', getErrorMessage(error));
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
      </View>

      <Card>
        <Text style={styles.label}>I am a...</Text>
        <View style={styles.roleRow}>
          {ROLE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              title={opt.label}
              variant={role === opt.value ? 'primary' : 'outline'}
              onPress={() => setRole(opt.value)}
              style={styles.roleButton}
            />
          ))}
        </View>

        <Text style={styles.label}>First Name</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Ram" />

        <Text style={styles.label}>Last Name</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Shrestha" />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+9779841234567"
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
              value={otp}
              onChangeText={setOtp}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
            />
            <Button title="Create Account" onPress={handleSignup} loading={loading} />
          </>
        )}

        <Button title="Back to Login" variant="outline" onPress={() => navigation.navigate('Login')} />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginVertical: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: FLITO_COLORS.secondary },
  label: { fontSize: 14, fontWeight: '600', color: FLITO_COLORS.secondary, marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  roleButton: { flex: 1, minWidth: 100, marginVertical: 4 },
});

export default SignupScreen;
