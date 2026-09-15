import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import Constants from 'expo-constants';
import { logout, setUser } from '../redux/slices/authSlice';
import Card from '../components/common/Card';
import Avatar from '../components/common/Avatar';
import VerifiedBadge from '../components/common/VerifiedBadge';
import Modal from '../components/common/Modal';
import ActionList from '../components/common/ActionList';
import { SettingsSection, SettingsRow } from '../components/common/SettingsList';
import Icon from '../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize } from '../theme/tokens';
import useScreenLayout from '../hooks/useScreenLayout';
import api from '../services/api';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { pickImages, takePhoto, uploadFiles } from '../services/uploads';
import { ROLES, MAX_AVATAR_BYTES } from '../utils/constants';
import { getErrorMessage, pluralize } from '../utils/helpers';
import { confirmAction, notify } from '../utils/alert';

const APP_VERSION = Constants?.expoConfig?.version;

const ROLE_LABEL = {
  [ROLES.SHIPPER]: 'Shipper',
  [ROLES.OWNER]: 'Truck Owner',
  [ROLES.DRIVER]: 'Driver',
  [ROLES.ADMIN]: 'Admin',
};

const ROLE_ICON = {
  [ROLES.SHIPPER]: 'shipper',
  [ROLES.OWNER]: 'owner',
  [ROLES.DRIVER]: 'driver',
  [ROLES.ADMIN]: 'admin',
};

const KYC_ROW = {
  not_submitted: { value: 'Submit an ID document to get verified', pill: { label: 'Not verified', tone: 'muted' } },
  pending: { value: 'Your documents are under review', pill: { label: 'Under review', tone: 'warning' } },
  approved: { value: 'Your documents were approved', pill: { label: 'Verified', tone: 'success' } },
  rejected: { value: 'Your documents need changes', pill: { label: 'Action needed', tone: 'error' } },
};

const AVATAR_SIZE = 104;
const BADGE_SIZE = 32;
// Centers the camera badge on the photo's circular edge at the lower right
// (45 degrees), where Google and LinkedIn place theirs.
const BADGE_OFFSET = Math.round(AVATAR_SIZE / 2 - (AVATAR_SIZE / 2) * Math.SQRT1_2 - BADGE_SIZE / 2);

// From this window width the summary card sits beside the settings.
const TWO_COLUMNS_FROM = 900;

const monthYear = (date) => (date
  ? new Date(date).toLocaleDateString('en-NP', { month: 'short', year: 'numeric' })
  : null);

// The profile photo is itself the button: tap it (or its camera badge) to
// change it. On a laptop, hovering dims the photo and says what a click does.
const ProfilePhotoButton = ({ user, busy, onPress }) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hasPhoto = Boolean(user?.avatarUrl);

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={hasPhoto ? 'Change profile photo' : 'Add profile photo'}
      style={styles.photoButton}
    >
      {focused && <View style={styles.photoFocusRing} pointerEvents="none" />}
      <Avatar uri={user?.avatarUrl} role={user?.role} size={AVATAR_SIZE} />

      {(hovered || busy) && (
        <View style={styles.photoOverlay} pointerEvents="none">
          {busy ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <>
              <Icon name="camera" size={iconSize.lg} color={colors.textOnDark} />
              <Text style={styles.photoOverlayText}>{hasPhoto ? 'Change' : 'Add photo'}</Text>
            </>
          )}
        </View>
      )}

      <View style={styles.photoBadge} pointerEvents="none">
        <Icon name="camera" size={iconSize.sm} color={colors.textPrimary} />
      </View>
    </Pressable>
  );
};

// How complete the profile is, and the one next thing worth doing, the way
// LinkedIn nudges a profile toward complete.
const ProfileStrength = ({ steps }) => {
  const done = steps.filter((step) => step.done).length;
  const percent = steps.length ? Math.round((done / steps.length) * 100) : 100;
  const next = steps.find((step) => !step.done && !step.waiting);
  const [hovered, setHovered] = useState(false);

  return (
    <View style={styles.strength}>
      <View style={styles.strengthHeader}>
        <Text style={styles.strengthTitle}>Profile strength</Text>
        <Text style={[styles.strengthValue, percent === 100 && styles.strengthValueComplete]}>{percent}%</Text>
      </View>
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View style={[styles.progressFill, { width: `${percent}%` }, percent === 100 && styles.progressComplete]} />
      </View>

      {next ? (
        <Pressable
          onPress={next.onPress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          accessibilityRole="button"
          accessibilityLabel={next.label}
          style={[styles.nextStep, hovered && styles.nextStepHovered]}
        >
          <View style={styles.nextStepIcon}>
            <Icon name="add" size={iconSize.sm} color={colors.primaryText} />
          </View>
          <Text style={styles.nextStepText}>{next.label}</Text>
          <Icon name="forward" size={iconSize.sm} color={colors.primaryText} />
        </Pressable>
      ) : (
        <View style={styles.strengthDone}>
          <Icon
            name={percent === 100 ? 'success' : 'pending'}
            size={iconSize.sm}
            color={percent === 100 ? colors.successText : colors.warningText}
          />
          <Text style={[styles.strengthDoneText, { color: percent === 100 ? colors.successText : colors.warningText }]}>
            {percent === 100 ? 'Your profile is complete' : 'Waiting on your identity review'}
          </Text>
        </View>
      )}
    </View>
  );
};

const ProfileScreen = ({ navigation }) => {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const layout = useScreenLayout('medium');
  const twoColumns = layout.width >= TWO_COLUMNS_FROM;
  const [photoBusy, setPhotoBusy] = useState(false);
  // The "Profile Photo" dialog: take one, upload one, or remove it.
  const [photoSheet, setPhotoSheet] = useState(false);

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

  const goEdit = () => navigation.navigate('EditProfile');

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

  const handleChangePhoto = async (source) => {
    setPhotoSheet(false);
    let asset;
    try {
      // A selfie comes from the front camera; either way it's cropped square.
      [asset] = source === 'camera'
        ? await takePhoto({ square: true, facing: 'user' })
        : await pickImages({ max: 1, square: true });
    } catch (error) {
      notify(source === 'camera' ? 'Could not open the camera' : 'Could not open photos', getErrorMessage(error));
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

  const isOwner = user?.role === ROLES.OWNER;
  const verifies = user?.role !== ROLES.ADMIN;
  const hasPhoto = Boolean(user?.avatarUrl);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const address = user?.address?.formatted;
  const goAddress = () => navigation.navigate('Address');
  const kycRow = KYC_ROW[user?.kycStatus] || KYC_ROW.not_submitted;
  const signInMethods = [user?.hasPassword && 'Email and password', user?.hasGoogle && 'Google']
    .filter(Boolean)
    .join(' and ') || 'Email';
  const memberSince = monthYear(user?.memberSince);

  const strengthSteps = [
    { key: 'photo', done: hasPhoto, label: 'Add a profile photo', onPress: () => setPhotoSheet(true) },
    user?.email && {
      key: 'email',
      done: Boolean(user.emailVerified),
      label: 'Verify your email',
      onPress: () => navigation.navigate('VerifyEmail'),
    },
    { key: 'phone', done: Boolean(user?.phone), label: 'Add your phone number', onPress: goEdit },
    isOwner && { key: 'company', done: Boolean(user?.companyName), label: 'Add your company name', onPress: goEdit },
    { key: 'address', done: Boolean(address), label: 'Add your address', onPress: goAddress },
    verifies && {
      key: 'identity',
      done: user?.kycStatus === 'approved',
      // Nothing for the user to do while documents are under review.
      waiting: user?.kycStatus === 'pending',
      label: user?.kycStatus === 'rejected' ? 'Fix your identity documents' : 'Verify your identity',
      onPress: () => navigation.navigate('Kyc'),
    },
  ].filter(Boolean);

  const summaryCard = (
    <Card style={styles.summary}>
      <ProfilePhotoButton user={user} busy={photoBusy} onPress={() => setPhotoSheet(true)} />
      <View style={styles.nameRow}>
        <Text style={styles.name}>{fullName || 'Your name'}</Text>
        {user?.kycStatus === 'approved' && <VerifiedBadge size={22} label="Verified by FLITO" />}
      </View>
      <View style={styles.identityRow}>
        <View style={styles.rolePill}>
          <Icon name={ROLE_ICON[user?.role] || 'person'} size={iconSize.xs} color={colors.primaryText} />
          <Text style={styles.roleText}>{ROLE_LABEL[user?.role] || user?.role}</Text>
        </View>
      </View>
      {!!user?.email && <Text style={styles.email} numberOfLines={1}>{user.email}</Text>}

      <View style={styles.stats}>
        <View style={styles.stat}>
          <View style={styles.statValueRow}>
            <Icon name="star" size={iconSize.sm} color={user?.rating ? colors.primary : colors.textMuted} />
            <Text style={styles.statValue}>{user?.rating ? user.rating.toFixed(1) : '-'}</Text>
          </View>
          <Text style={styles.statLabel}>
            {user?.totalRatings ? pluralize(user.totalRatings, 'rating') : 'No ratings yet'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{memberSince || '-'}</Text>
          <Text style={styles.statLabel}>Member since</Text>
        </View>
      </View>

      <ProfileStrength steps={strengthSteps} />
    </Card>
  );

  const settings = (
    <>
      <SettingsSection
        title="Personal Information"
        description="How shippers, owners and drivers see you"
        actionLabel="Edit"
        onAction={goEdit}
      >
        <SettingsRow icon="person" label="Full Name" value={fullName || 'Not added'} valueMuted={!fullName} onPress={goEdit} />
        <SettingsRow icon="phone" label="Phone" value={user?.phone || 'Not added'} valueMuted={!user?.phone} onPress={goEdit} />
        {isOwner && (
          <SettingsRow icon="owner" label="Company" value={user?.companyName || 'Not added'} valueMuted={!user?.companyName} onPress={goEdit} />
        )}
        <SettingsRow icon="location" label="Address" value={address || 'Not added'} valueMuted={!address} onPress={goAddress} />
      </SettingsSection>

      <SettingsSection title="Verification" description="Verified accounts are trusted with quotes and bookings">
        {user?.email ? (
          <SettingsRow
            icon="email"
            label="Email"
            value={user.email}
            pill={user.emailVerified ? { label: 'Verified', tone: 'success' } : { label: 'Not verified', tone: 'warning' }}
            onPress={user.emailVerified ? undefined : () => navigation.navigate('VerifyEmail')}
          />
        ) : null}
        {verifies ? (
          <SettingsRow
            icon="idCard"
            label="Identity"
            value={user?.kycStatus === 'rejected' && user?.kycRejectionReason ? user.kycRejectionReason : kycRow.value}
            pill={kycRow.pill}
            onPress={() => navigation.navigate('Kyc')}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection title="Sign-in and Security">
        <SettingsRow icon="lock" label="Sign-in Method" value={signInMethods} />
        <SettingsRow icon="logout" label="Log Out" destructive onPress={handleLogout} accessibilityLabel="Log out" />
      </SettingsSection>

      {!!APP_VERSION && <Text style={styles.version}>FLITO version {APP_VERSION}</Text>}
    </>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={layout.contentStyle}>
      {twoColumns ? (
        <View style={styles.columns}>
          <View style={styles.sideColumn}>{summaryCard}</View>
          <View style={styles.mainColumn}>{settings}</View>
        </View>
      ) : (
        <>
          {summaryCard}
          <View style={styles.stackedSettings}>{settings}</View>
        </>
      )}

      <Modal visible={photoSheet} size="sm" title="Profile Photo" onClose={() => setPhotoSheet(false)}>
        <View style={styles.sheetHeader}>
          <Avatar uri={user?.avatarUrl} role={user?.role} size={56} />
          <Text style={styles.sheetHint}>A clear photo of your face helps people recognize you.</Text>
        </View>
        <ActionList
          dense
          actions={[
            { icon: 'camera', label: 'Take Photo', onPress: () => handleChangePhoto('camera') },
            { icon: 'image', label: 'Upload Photo', onPress: () => handleChangePhoto('library') },
            hasPhoto && {
              icon: 'trash',
              label: 'Remove Photo',
              destructive: true,
              onPress: () => { setPhotoSheet(false); handleRemovePhoto(); },
            },
          ]}
        />
        <Text style={styles.sheetNote}>JPEG, PNG, WebP or HEIC, up to 5 MB</Text>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxl },
  sideColumn: { width: 320 },
  mainColumn: { flex: 1, minWidth: 0, paddingTop: spacing.sm },
  stackedSettings: { marginTop: spacing.xl },

  // Summary card
  summary: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, marginVertical: 0 },
  photoButton: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginBottom: spacing.lg,
  },
  photoFocusRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: AVATAR_SIZE / 2 + 4,
    borderWidth: 2,
    borderColor: colors.focusRing,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  photoOverlayText: { ...type.smallMedium, color: colors.textOnDark },
  photoBadge: {
    position: 'absolute',
    right: BADGE_OFFSET,
    bottom: BADGE_OFFSET,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.level2,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, maxWidth: '100%' },
  name: { ...type.h2, color: colors.textPrimary, textAlign: 'center', flexShrink: 1 },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  roleText: { ...type.caption, fontSize: 11, color: colors.primaryText },
  email: { ...type.small, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', maxWidth: '100%' },

  stats: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { ...type.bodyMedium, color: colors.textPrimary },
  statLabel: { ...type.small, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.divider },

  // Profile strength
  strength: { alignSelf: 'stretch', marginTop: spacing.lg },
  strengthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  strengthTitle: { ...type.smallMedium, color: colors.textPrimary },
  strengthValue: { ...type.smallMedium, color: colors.primaryText },
  strengthValueComplete: { color: colors.successText },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  progressComplete: { backgroundColor: colors.success },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
  },
  nextStepHovered: { backgroundColor: 'rgba(255, 159, 0, 0.22)' },
  nextStepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepText: { ...type.smallMedium, color: colors.primaryText, flex: 1 },
  strengthDone: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  strengthDoneText: { ...type.smallMedium },

  version: { ...type.small, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: -spacing.sm },

  // Profile photo dialog
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  sheetHint: { ...type.small, color: colors.textSecondary, flex: 1 },
  sheetNote: { ...type.small, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});

export default ProfileScreen;
