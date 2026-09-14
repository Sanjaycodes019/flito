import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { logout, setUser } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { ROLES } from '../utils/constants';
import { confirmAction } from '../utils/alert';

const KYC_SUMMARY = {
  not_submitted: { label: 'Not verified', action: 'Verify Identity', color: colors.textMuted, icon: 'unverified' },
  pending: { label: 'Under review', action: 'View Documents', color: colors.warningText, icon: 'pending' },
  approved: { label: 'Verified', action: 'View Documents', color: colors.successText, icon: 'verified' },
  rejected: { label: 'Changes needed', action: 'Fix Documents', color: colors.errorText, icon: 'unverified' },
};

const ROLE_ICON = {
  [ROLES.SHIPPER]: 'shipper',
  [ROLES.OWNER]: 'owner',
  [ROLES.DRIVER]: 'driver',
  [ROLES.ADMIN]: 'admin',
};

const Row = ({ icon, label, value }) => (
  <View style={styles.row}>
    <Icon name={icon} size={iconSize.sm} color={colors.textMuted} style={styles.rowIcon} />
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

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
        <View style={styles.avatar}>
          <Icon name={ROLE_ICON[user?.role] || 'person'} size={iconSize.xl} color={colors.textOnDark} />
        </View>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.phone}>{user?.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </Card>

      {user?.email && (
        <Card>
          <View style={styles.verifyRow}>
            <Icon
              name={user.emailVerified ? 'verified' : 'unverified'}
              size={iconSize.md}
              color={user.emailVerified ? colors.successText : colors.warningText}
              style={styles.rowIcon}
            />
            <Text style={styles.rowLabel}>Email Verification</Text>
            <Text style={[styles.rowValue, { color: user.emailVerified ? colors.successText : colors.warningText }]}>
              {user.emailVerified ? 'Verified' : 'Not verified'}
            </Text>
          </View>
          {!user.emailVerified && (
            <Button title="Verify Now" icon="checkmark" variant="tertiary" onPress={() => navigation.navigate('VerifyEmail')} />
          )}
        </Card>
      )}

      {verifies && (
        <Card>
          <View style={styles.verifyRow}>
            <Icon name={kyc.icon} size={iconSize.md} color={kyc.color} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Identity Verification</Text>
            <Text style={[styles.rowValue, { color: kyc.color }]}>{kyc.label}</Text>
          </View>
          {user?.kycStatus === 'rejected' && user?.kycRejectionReason ? (
            <Text style={styles.reason}>{user.kycRejectionReason}</Text>
          ) : null}
          <Button
            title={kyc.action}
            icon={kyc.icon}
            variant={user?.kycStatus === 'approved' ? 'tertiary' : 'primary'}
            onPress={() => navigation.navigate('Kyc')}
          />
        </Card>
      )}

      <Card>
        <Row
          icon="star"
          label="Rating"
          value={user?.rating ? `${user.rating.toFixed(1)} (${user.totalRatings})` : 'No ratings yet'}
        />
        {user?.companyName ? <Row icon="owner" label="Company" value={user.companyName} /> : null}
        {user?.phone ? <Row icon="phone" label="Phone" value={user.phone} /> : null}
        {user?.address?.city ? <Row icon="location" label="City" value={user.address.city} /> : null}
      </Card>

      <Button title="Edit Profile" icon="edit" variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
      <Button title="Log Out" icon="logout" variant="tertiary" onPress={handleLogout} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  headerCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  name: { ...type.h2, color: colors.secondary },
  phone: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  badge: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxs,
  },
  badgeText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  verifyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  rowIcon: { marginRight: spacing.sm },
  rowLabel: { flex: 1, color: colors.textMuted, ...type.body },
  rowValue: { color: colors.textPrimary, ...type.bodyMedium },
  reason: { ...type.small, color: colors.errorText, marginTop: spacing.sm, marginBottom: spacing.sm },
});

export default ProfileScreen;
