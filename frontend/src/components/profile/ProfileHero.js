import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import VerifiedBadge from '../common/VerifiedBadge';
import Icon from '../../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize } from '../../theme/tokens';
import { ROLES } from '../../utils/constants';
import { formatMonthYear } from '../../utils/nepalDate';

const ROLE_ICON = {
  [ROLES.SHIPPER]: 'shipper',
  [ROLES.OWNER]: 'owner',
  [ROLES.DRIVER]: 'driver',
  [ROLES.ADMIN]: 'admin',
};

// Tone per identity status; the wording comes from the profile translations.
const KYC_TONE = { not_submitted: 'muted', pending: 'warning', approved: 'success', rejected: 'error' };
const TONE_COLORS = {
  muted: { bg: colors.surfaceMuted, fg: colors.textMuted },
  warning: { bg: colors.warningMuted, fg: colors.warningText },
  success: { bg: colors.successMuted, fg: colors.successText },
  error: { bg: colors.errorMuted, fg: colors.errorText },
};

const AVATAR = 96;
const RING = 4;
const BADGE = 30;

const monthYear = formatMonthYear;

// The profile photo is itself the button: tap it (or its camera badge) to
// change it. On a laptop, hovering dims the photo and says what a click does.
const PhotoButton = ({ user, busy, onPress }) => {
  const { t } = useTranslation();
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
      accessibilityLabel={hasPhoto ? t('profile:photoButton.changeLabel') : t('profile:photoButton.addLabel')}
      style={styles.photoRing}
    >
      {focused && <View style={styles.focusRing} pointerEvents="none" />}
      <Avatar uri={user?.avatarUrl} role={user?.role} size={AVATAR} />
      {(hovered || busy) && (
        <View style={styles.photoOverlay} pointerEvents="none">
          {busy ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <>
              <Icon name="camera" size={iconSize.lg} color={colors.textOnDark} />
              <Text style={styles.photoOverlayText}>{hasPhoto ? t('profile:photoButton.changeOverlay') : t('profile:photoButton.addOverlay')}</Text>
            </>
          )}
        </View>
      )}
      <View style={styles.badge} pointerEvents="none">
        <Icon name="camera" size={iconSize.sm} color={colors.textPrimary} />
      </View>
    </Pressable>
  );
};

const StatTile = ({ icon, value, label, tone }) => {
  const palette = TONE_COLORS[tone] || { bg: colors.primaryMuted, fg: colors.primaryText };
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: palette.bg }]}>
        <Icon name={icon} size={iconSize.sm} color={palette.fg} />
      </View>
      <Text style={styles.tileValue} numberOfLines={2}>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
};

// The top of the profile: a cover band, the photo overlapping its edge, who
// this is, the one thing you most likely want to do (edit), and three facts at
// a glance. `horizontal` lays the person and actions side by side on a wide
// single column.
const ProfileHero = ({ user, busy, onPhoto, onEdit, horizontal }) => {
  const { t } = useTranslation();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const kycKey = KYC_TONE[user?.kycStatus] ? user.kycStatus : 'not_submitted';
  const verifies = user?.role !== ROLES.ADMIN;
  const member = monthYear(user?.memberSince);

  const identity = (
    <View style={[styles.identity, horizontal && styles.identityHorizontal]}>
      <View style={[styles.nameRow, horizontal && styles.nameRowHorizontal]}>
        <Text style={styles.name} numberOfLines={2}>{fullName || t('profile:summary.nameFallback')}</Text>
        {user?.kycStatus === 'approved' && <VerifiedBadge size={22} label={t('profile:summary.verifiedByFlito')} />}
      </View>
      <View style={[styles.pills, horizontal && styles.pillsHorizontal]}>
        <View style={styles.rolePill}>
          <Icon name={ROLE_ICON[user?.role] || 'person'} size={iconSize.xs} color={colors.primaryText} />
          <Text style={styles.roleText}>{t(`profile:roles.${user?.role}`, user?.role)}</Text>
        </View>
      </View>
      {!!user?.email && <Text style={styles.email} numberOfLines={1}>{user.email}</Text>}
    </View>
  );

  const actions = (
    <View style={[styles.actions, horizontal && styles.actionsHorizontal]}>
      <Button title={t('profile:hero.edit')} icon="edit" onPress={onEdit} style={styles.actionButton} />
      <Button title={t('profile:hero.photo')} icon="camera" variant="tertiary" onPress={onPhoto} style={styles.actionButton} />
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.cover}>
        <View style={[styles.blob, styles.blobLarge]} />
        <View style={[styles.blob, styles.blobSmall]} />
      </View>

      <View style={styles.body}>
        {horizontal ? (
          <View style={styles.horizontalRow}>
            <View style={styles.photoLift}><PhotoButton user={user} busy={busy} onPress={onPhoto} /></View>
            {identity}
            {actions}
          </View>
        ) : (
          <>
            <View style={styles.photoCenter}><PhotoButton user={user} busy={busy} onPress={onPhoto} /></View>
            {identity}
            {actions}
          </>
        )}

        <View style={styles.tiles}>
          <StatTile
            icon="star"
            value={user?.rating ? user.rating.toFixed(1) : '-'}
            label={user?.totalRatings ? t('profile:summary.rating', { count: user.totalRatings }) : t('profile:summary.ratingsNone')}
          />
          <StatTile icon="calendar" value={member || '-'} label={t('profile:summary.memberSince')} />
          {verifies ? (
            <StatTile icon="idCard" tone={KYC_TONE[kycKey]} value={t(`profile:kyc.${kycKey}.pill`)} label={t('profile:rows.identity')} />
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.level1 },
  cover: { height: 104, backgroundColor: colors.surfaceDark, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.primary },
  blobLarge: { width: 190, height: 190, top: -90, right: -40, opacity: 0.9 },
  blobSmall: { width: 90, height: 90, bottom: -50, left: 30, opacity: 0.35 },
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },

  photoCenter: { alignItems: 'center', marginTop: -(AVATAR / 2 + RING) },
  photoLift: { marginTop: -(AVATAR / 2 + RING) },
  photoRing: {
    width: AVATAR + RING * 2,
    height: AVATAR + RING * 2,
    borderRadius: (AVATAR + RING * 2) / 2,
    borderWidth: RING,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  focusRing: { position: 'absolute', top: -RING - 2, left: -RING - 2, right: -RING - 2, bottom: -RING - 2, borderRadius: 999, borderWidth: 2, borderColor: colors.focusRing },
  photoOverlay: { ...StyleSheet.absoluteFillObject, borderRadius: 999, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', gap: spacing.xxs },
  photoOverlayText: { ...type.smallMedium, color: colors.textOnDark },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: 2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.level2,
  },

  identity: { alignItems: 'center', marginTop: spacing.md },
  identityHorizontal: { alignItems: 'flex-start', flex: 1, marginTop: spacing.md, marginLeft: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, maxWidth: '100%' },
  nameRowHorizontal: { justifyContent: 'flex-start' },
  name: { ...type.h1, color: colors.textPrimary, textAlign: 'center', flexShrink: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  pillsHorizontal: { justifyContent: 'flex-start' },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryMuted, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  roleText: { ...type.caption, color: colors.primaryText },
  email: { ...type.small, color: colors.textMuted, marginTop: spacing.sm, maxWidth: '100%' },

  horizontalRow: { flexDirection: 'row', alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, alignSelf: 'stretch' },
  actionsHorizontal: { alignSelf: 'auto', marginTop: spacing.lg },
  actionButton: { flex: 1 },

  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  tile: { flex: 1, minWidth: 0, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md },
  tileIcon: { width: 30, height: 30, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  tileValue: { ...type.bodyMedium, color: colors.textPrimary },
  tileLabel: { ...type.small, fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

export default ProfileHero;
