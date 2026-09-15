import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { logout, setUser } from '../redux/slices/authSlice';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import useScreenLayout from '../hooks/useScreenLayout';
import api from '../services/api';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { pickImages, uploadFiles } from '../services/uploads';
import { ROLES, MAX_AVATAR_BYTES } from '../utils/constants';
import { getErrorMessage } from '../utils/helpers';
import { confirmAction, notify } from '../utils/alert';

const KYC_SUMMARY = {
  not_submitted: { label: 'Not verified', action: 'Verify Identity', color: colors.textMuted, icon: 'unverified' },
  pending: { label: 'Under review', action: 'View Documents', color: colors.warningText, icon: 'pending' },
  approved: { label: 'Verified', action: 'View Documents', color: colors.successText, icon: 'verified' },
  rejected: { label: 'Changes needed', action: 'Fix Documents', color: colors.errorText, icon: 'unverified' },
};

const AVATAR_SIZE = 96;

// Below this window width the identity card and the details sit one above
// the other; from here up they fit side by side.
const TWO_COLUMNS_FROM = 840;

const Row = ({ icon, label, value, muted, last }) => (
  <View style={[styles.row, last && styles.rowLast]}>
    <Icon name={icon} size={iconSize.sm} color={colors.textMuted} style={styles.rowIcon} />
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, muted && styles.rowValueMuted]} numberOfLines={1}>{value}</Text>
  </View>
);

const ProfileScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const layout = useScreenLayout('medium');
  const twoColumns = layout.width >= TWO_COLUMNS_FROM;
  const [photoBusy, setPhotoBusy] = useState(false);

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

  const handleChangePhoto = async () => {
    let asset;
    try {
      [asset] = await pickImages({ max: 1, square: true });
    } catch (error) {
      notify('Could not open photos', getErrorMessage(error));
      return;
    }
    if (!asset) return;

    const size = asset.fileSize || asset.file?.size;
    if (size && size > MAX_AVATAR_BYTES) {
      notify('Photo too large', 'Choose a photo of 5 MB or smaller');
      return;
    }

    setPhotoBusy(true);
    try {
      const data = await uploadFiles('/users/me/avatar', [asset], { field: 'avatar' });
      dispatch(setUser(data.user));
    } catch (error) {
      notify('Could not update photo', getErrorMessage(error));
    }
    setPhotoBusy(false);
  };

  const handleRemovePhoto = () => confirmAction({
    title: 'Remove profile photo',
    message: 'Your photo will be replaced with your role icon.',
    confirmLabel: 'Remove',
    destructive: true,
    onConfirm: async () => {
      setPhotoBusy(true);
      try {
        const { data } = await api.delete('/users/me/avatar');
        dispatch(setUser(data.user));
      } catch (error) {
        notify('Could not remove photo', getErrorMessage(error));
      }
      setPhotoBusy(false);
    },
  });

  const kyc = KYC_SUMMARY[user?.kycStatus] || KYC_SUMMARY.not_submitted;
  const verifies = user?.role !== ROLES.ADMIN;

  const detailRows = [
    {
      icon: 'star',
      label: 'Rating',
      value: user?.rating ? `${user.rating.toFixed(1)} (${user.totalRatings})` : 'No ratings yet',
      muted: !user?.rating,
    },
    user?.role === ROLES.OWNER
      ? { icon: 'owner', label: 'Company', value: user?.companyName || 'Not added', muted: !user?.companyName }
      : null,
    { icon: 'phone', label: 'Phone', value: user?.phone || 'Not added', muted: !user?.phone },
    { icon: 'location', label: 'City', value: user?.address?.city || 'Not added', muted: !user?.address?.city },
  ].filter(Boolean);

  const accountActions = (
    <>
      <Button title="Edit Profile" icon="edit" variant="secondary" onPress={() => navigation.navigate('EditProfile')} />
      <Button title="Log Out" icon="logout" variant="tertiary" onPress={handleLogout} />
    </>
  );

  const identityCard = (
    <Card style={styles.identityCard}>
      <View style={styles.avatarWrap}>
        <Avatar
          uri={user?.avatarUrl}
          role={user?.role}
          size={AVATAR_SIZE}
          accessibilityLabel={user?.avatarUrl ? 'Your profile photo' : undefined}
        />
        {photoBusy && (
          <View style={styles.avatarBusy}>
            <ActivityIndicator color={colors.textOnDark} />
          </View>
        )}
        <Pressable
          onPress={handleChangePhoto}
          disabled={photoBusy}
          accessibilityRole="button"
          accessibilityLabel={user?.avatarUrl ? 'Change profile photo' : 'Add profile photo'}
          hitSlop={8}
          style={styles.avatarEdit}
        >
          <Icon name="camera" size={iconSize.sm} color={colors.textOnPrimary} />
        </Pressable>
      </View>
      <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
      {!!user?.email && <Text style={styles.email} numberOfLines={1}>{user.email}</Text>}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{user?.role?.toUpperCase()}</Text>
      </View>
      <Button
        title={user?.avatarUrl ? 'Remove Photo' : 'Add Photo'}
        icon={user?.avatarUrl ? 'trash' : 'camera'}
        variant="ghost"
        size="sm"
        onPress={user?.avatarUrl ? handleRemovePhoto : handleChangePhoto}
        disabled={photoBusy}
        style={styles.photoAction}
      />
      {twoColumns && <View style={styles.identityActions}>{accountActions}</View>}
    </Card>
  );

  const emailCard = user?.email ? (
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
  ) : null;

  const kycCard = verifies ? (
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
  ) : null;

  const detailsCard = (
    <Card>
      <Text style={styles.cardTitle}>Account Details</Text>
      {detailRows.map((row, index) => (
        <Row key={row.label} {...row} last={index === detailRows.length - 1} />
      ))}
    </Card>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={styles.sideColumn}>{identityCard}</View>
          <View style={styles.mainColumn}>
            {emailCard}
            {kycCard}
            {detailsCard}
          </View>
        </View>
      ) : (
        <>
          {identityCard}
          {emailCard}
          {kycCard}
          {detailsCard}
          {accountActions}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  sideColumn: { width: 300 },
  mainColumn: { flex: 1, minWidth: 0 },

  identityCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatarWrap: { marginBottom: spacing.md },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The camera badge on the photo's lower edge: tap to add or change it.
  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAction: { marginTop: spacing.sm },
  name: { ...type.h2, color: colors.secondary, textAlign: 'center' },
  email: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs, textAlign: 'center', maxWidth: '100%' },
  badge: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxs,
  },
  badgeText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  identityActions: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },

  cardTitle: { ...type.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  rowIcon: { marginRight: spacing.sm },
  rowLabel: { flex: 1, color: colors.textMuted, ...type.body },
  rowValue: { color: colors.textPrimary, ...type.bodyMedium, flexShrink: 1, textAlign: 'right' },
  rowValueMuted: { color: colors.textMuted, fontWeight: '400' },
  reason: { ...type.small, color: colors.errorText, marginTop: spacing.sm, marginBottom: spacing.sm },
});

export default ProfileScreen;
