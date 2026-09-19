import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Icon from '../../theme/icons';
import Avatar from '../common/Avatar';
import LanguageToggle from '../common/LanguageToggle';
import { BrandMark } from './DesktopNav';
import { logout } from '../../redux/slices/authSlice';
import { authService } from '../../services/auth';
import socketService from '../../services/socket';
import { confirmAction } from '../../utils/alert';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

export const SIDEBAR_WIDTH = 264;

const ROLE_ICON = { shipper: 'shipper', owner: 'owner', driver: 'driver', admin: 'admin' };

const Badge = ({ value }) => {
  if (!value) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{value > 99 ? '99+' : value}</Text>
    </View>
  );
};

// One row of a sidebar: a tinted pill and the brand colour for the page you
// are on, a count for pending work. The same look as the phone's bottom bar.
export const SidebarNavItem = ({ icon, label, active, badge, onPress }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.item, hovered && !active && styles.itemHovered, active && styles.itemActive]}
    >
      {active ? <View style={styles.activeBar} /> : null}
      <Icon name={icon} size={iconSize.md} color={active ? colors.primaryText : colors.textSecondary} />
      <Text style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={1}>{label}</Text>
      <Badge value={badge} />
    </Pressable>
  );
};

// A small icon-over-label button in the account card.
const FooterTile = ({ icon, label, active, destructive, onPress }) => {
  const [hovered, setHovered] = useState(false);
  const tint = destructive ? colors.errorText : active ? colors.primaryText : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={[
        styles.tile,
        hovered && (destructive ? styles.tileHoveredDanger : styles.tileHovered),
        active && styles.tileActive,
      ]}
    >
      <Icon name={icon} size={iconSize.md} color={tint} />
      <Text style={[styles.tileLabel, { color: tint }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
};

// You, at the bottom of every sidebar: photo with a status dot, name and role,
// then Home, Profile and Log out, and the language switch. `current` is which
// of Home or Profile the page belongs to, if either.
export const AccountCard = ({ current }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || t(`profile:roles.${user?.role}`, user?.role);

  const handleLogout = () => confirmAction({
    title: t('profile:logout.title'),
    message: t('profile:logout.message'),
    confirmLabel: t('profile:logout.confirmLabel'),
    destructive: true,
    onConfirm: async () => {
      await authService.logout();
      socketService.disconnect();
      dispatch(logout());
    },
  });

  return (
    <View style={styles.account}>
      <View style={styles.accountHead}>
        <View>
          <Avatar uri={user?.avatarUrl} role={user?.role} size={44} />
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.userText}>
          <Text style={styles.userName} numberOfLines={1}>{name}</Text>
          <View style={styles.roleTag}>
            <Icon name={ROLE_ICON[user?.role] || 'person'} size={10} color={colors.primaryText} />
            <Text style={styles.roleTagText}>{t(`profile:roles.${user?.role}`, user?.role)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tiles}>
        <FooterTile
          icon={current === 'home' ? 'homeActive' : 'home'}
          label={t('navigation:tabs.home')}
          active={current === 'home'}
          onPress={() => current !== 'home' && navigation.navigate('HomeTab', { screen: 'Home' })}
        />
        <FooterTile
          icon={current === 'profile' ? 'profileActive' : 'profile'}
          label={t('navigation:tabs.profile')}
          active={current === 'profile'}
          onPress={() => current !== 'profile' && navigation.navigate('Profile', { screen: 'ProfileHome' })}
        />
        <FooterTile icon="logout" label={t('profile:rows.logOut')} destructive onPress={handleLogout} />
      </View>

      <View style={styles.languageRow}>
        <Text style={styles.languageLabel}>{t('common:language.label')}</Text>
        <LanguageToggle compact />
      </View>
    </View>
  );
};

// The frame of a laptop sidebar. Every role's sidebar is this, so they look
// like one product: the FLITO mark, a tag saying which console you are in, an
// optional main action, a labelled group of navigation rows (children), and
// the account card.
export const SidebarFrame = ({ tagIcon, tag, group, action, current, children }) => (
  <View style={styles.sidebar}>
    <View style={styles.brandRow}>
      <BrandMark />
    </View>
    <View style={styles.consoleTag}>
      <Icon name={tagIcon} size={iconSize.xs} color={colors.primaryText} />
      <Text style={styles.consoleTagText}>{tag}</Text>
    </View>

    {action ? <View style={styles.action}>{action}</View> : null}

    <Text style={styles.groupLabel}>{group}</Text>
    {/* Only the menu scrolls, so the account card below stays pinned to the
        bottom edge however long the menu or short the window. */}
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>

    <View style={styles.accountWrap}>
      <AccountCard current={current} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.divider,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  brandRow: { marginLeft: -spacing.xs },
  consoleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    marginLeft: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  consoleTagText: { ...type.caption, color: colors.primaryText, textTransform: 'uppercase', letterSpacing: 0.6 },
  action: { marginTop: spacing.xl },
  groupLabel: {
    ...type.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  list: { flex: 1, minHeight: 0 },
  listContent: { gap: spacing.xxs },
  accountWrap: { flexShrink: 0, paddingTop: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  itemHovered: { backgroundColor: colors.surfaceMuted },
  itemActive: { backgroundColor: colors.primaryMuted },
  activeBar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: colors.primaryText },
  itemLabel: { ...type.bodyMedium, color: colors.textSecondary, flexShrink: 1 },
  itemLabelActive: { color: colors.primaryText },
  badge: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.warningText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.textOnDark },

  account: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surfaceMuted,
  },
  userText: { flex: 1, minWidth: 0, gap: spacing.xxs + 1 },
  userName: { ...type.bodyMedium, color: colors.textPrimary },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
  },
  roleTagText: { ...type.caption, fontSize: 10, color: colors.primaryText, textTransform: 'uppercase', letterSpacing: 0.5 },
  tiles: { flexDirection: 'row', gap: spacing.xs },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 58,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  tileHovered: { borderColor: colors.border, backgroundColor: colors.surface },
  tileHoveredDanger: { backgroundColor: colors.errorMuted, borderColor: colors.errorMuted },
  tileActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryText },
  tileLabel: { fontSize: 11, fontWeight: '600' },
  languageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  languageLabel: { ...type.small, color: colors.textMuted },
});
