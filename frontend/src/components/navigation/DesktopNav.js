import React, { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Avatar from '../common/Avatar';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../theme/tokens';

const LOGO = require('../../../assets/icon.png');

// The two tabs, as top-bar links. On desktop the bottom tab bar is hidden
// (see TabNavigator), so these are how a laptop user moves between them.
// `labelKey` is resolved with t() at render time (inside NavLink), not here,
// so this stays a plain module-level list that doesn't go stale on a
// language change.
const LINKS = [
  { tab: 'HomeTab', screen: 'Home', labelKey: 'navigation:tabs.home', icon: 'home', activeIcon: 'homeActive' },
  { tab: 'Profile', screen: 'ProfileHome', labelKey: 'navigation:tabs.profile', icon: 'profile', activeIcon: 'profileActive' },
];

// The FLITO mark in the header's left slot on a tab's first screen. The
// wordmark keeps the true brand amber: WCAG contrast minimums do not apply to
// logotype (see theme/tokens.js primaryText).
export const BrandMark = () => {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.navigate('HomeTab', { screen: 'Home' })}
      style={styles.brand}
      accessibilityRole="link"
      accessibilityLabel="FLITO"
    >
      <Image source={LOGO} style={styles.logo} resizeMode="contain" accessible={false} />
      <Text style={styles.wordmark}>FLITO</Text>
    </Pressable>
  );
};

const NavLink = ({ link, active }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const user = useSelector((state) => state.auth.user);
  // The Profile link shows the user's own photo once they have one.
  const photo = link.tab === 'Profile' ? user?.avatarUrl : null;
  const label = t(link.labelKey);

  return (
    <Pressable
      onPress={() => navigation.navigate(link.tab, { screen: link.screen })}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.link, hovered && styles.linkHovered, active && styles.linkActive]}
    >
      {photo ? (
        <Avatar uri={photo} size={24} />
      ) : (
        <Icon
          name={active ? link.activeIcon : link.icon}
          size={iconSize.md}
          color={active ? colors.primaryText : colors.textSecondary}
        />
      )}
      <Text style={[styles.linkText, active && styles.linkTextActive]}>{label}</Text>
    </Pressable>
  );
};

// The signed-in user's avatar, opening Profile. For admins on a phone or tablet,
// whose bottom bar holds the admin sections instead of a Profile tab.
export const ProfileButton = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const user = useSelector((state) => state.auth.user);
  return (
    <Pressable
      onPress={() => navigation.navigate('Profile', { screen: 'ProfileHome' })}
      accessibilityRole="button"
      accessibilityLabel={t('navigation:tabs.profile')}
      hitSlop={6}
    >
      <Avatar uri={user?.avatarUrl} role={user?.role} size={32} />
    </Pressable>
  );
};

export const TopNavLinks = ({ activeTab }) => (
  <View style={styles.links}>
    {LINKS.map((link) => (
      <NavLink key={link.tab} link={link} active={link.tab === activeTab} />
    ))}
  </View>
);

const styles = themedStyles(() => ({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.md, marginRight: spacing.lg },
  logo: { width: 32, height: 32, borderRadius: radius.md },
  wordmark: { ...type.h3, fontWeight: '800', color: colors.primary, letterSpacing: 1 },
  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginRight: spacing.lg },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  linkHovered: { backgroundColor: colors.surfaceMuted },
  linkActive: { backgroundColor: colors.primaryMuted },
  linkText: { ...type.smallMedium, color: colors.textSecondary },
  linkTextActive: { color: colors.primaryText },
}));
