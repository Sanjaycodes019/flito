import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { logout, setUser } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { FLITO_COLORS } from '../utils/colors';
import { ROLES } from '../utils/constants';
import { confirmAction } from '../utils/alert';

const KYC_SUMMARY = {
  not_submitted: { label: 'Not verified', action: 'Verify Identity', color: FLITO_COLORS.textMuted },
  pending: { label: 'Under review', action: 'View Documents', color: FLITO_COLORS.warning },
  approved: { label: 'Verified', action: 'View Documents', color: FLITO_COLORS.success },
  rejected: { label: 'Changes needed', action: 'Fix Documents', color: FLITO_COLORS.error },
};

const ProfileScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  // A review can finish while the app is open, so refresh on every visit.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      authService.me()
        .then(({ user: fresh }) => { if (active) dispatch(setUser(fresh)); })
        .catch(() => {});
      return () => { active = false; };
    }, [dispatch])
  );

  const handleLogout = () => {
    confirmAction({
      title: 'Log out',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Log out',
      destructive: true,
      onConfirm: async () => {
        await authService.logout();
        socketService.disconnect();
        dispatch(logout());
      },
    });
  };

  const kyc = KYC_SUMMARY[user?.kycStatus] || KYC_SUMMARY.not_submitted;
  const verifies = user?.role !== ROLES.ADMIN;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.headerCard}>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </Card>

      {verifies && (
        <Card>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Identity Verification</Text>
            <Text style={[styles.rowValue, { color: kyc.color }]}>{kyc.label}</Text>
          </View>
          {user?.kycStatus === 'rejected' && user?.kycRejectionReason ? (
            <Text style={styles.reason}>{user.kycRejectionReason}</Text>
          ) : null}
          <Button
            title={kyc.action}
            variant={user?.kycStatus === 'approved' ? 'outline' : 'primary'}
            onPress={() => navigation.navigate('Kyc')}
          />
        </Card>
      )}

      <Card>
        <Row label="Rating" value={user?.rating ? `${user.rating.toFixed(1)} ★ (${user.totalRatings})` : 'No ratings yet'} />
        {user?.companyName ? <Row label="Company" value={user.companyName} /> : null}
        {user?.email ? <Row label="Email" value={user.email} /> : null}
        {user?.address?.city ? <Row label="City" value={user.address.city} /> : null}
      </Card>

      <Button title="Edit Profile" variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
      <Button title="Log Out" variant="outline" onPress={handleLogout} />
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
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
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
  reason: { fontSize: 13, color: FLITO_COLORS.error, marginTop: 8 },
});

export default ProfileScreen;
