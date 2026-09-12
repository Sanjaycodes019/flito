import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { FLITO_COLORS } from '../utils/colors';

const ProfileScreen = () => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          socketService.disconnect();
          dispatch(logout());
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.headerCard}>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </Card>

      <Card>
        <Row label="KYC Status" value={user?.kycStatus || 'pending'} />
        <Row label="Rating" value={user?.rating ? `${user.rating.toFixed(1)} ★` : 'No ratings yet'} />
      </Card>

      <Button title="Log Out" variant="outline" onPress={handleLogout} style={styles.logoutButton} />
    </ScrollView>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background, padding: 16 },
  headerCard: { alignItems: 'center', paddingVertical: 24 },
  name: { fontSize: 20, fontWeight: 'bold', color: FLITO_COLORS.secondary },
  phone: { fontSize: 14, color: FLITO_COLORS.textMuted, marginTop: 4 },
  badge: {
    marginTop: 12,
    backgroundColor: FLITO_COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  badgeText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  rowLabel: { color: FLITO_COLORS.textMuted, fontSize: 14 },
  rowValue: { color: FLITO_COLORS.secondary, fontSize: 14, fontWeight: '600' },
  logoutButton: { marginTop: 16 },
});

export default ProfileScreen;
