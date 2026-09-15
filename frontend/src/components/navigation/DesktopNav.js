import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Avatar from '../common/Avatar';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';

const LOGO = require('../../../assets/icon.png');

// The two tabs, as top-bar links. On desktop the bottom tab bar is hidden
// (see TabNavigator), so these are how a laptop user moves between them.
const LINKS = [
  { tab: 'HomeTab', screen: 'Home', label: 'Home', icon: 'home', activeIcon: 'homeActive' },
  { tab: 'Profile', screen: 'ProfileHome', label: 'Profile', icon: 'profile', activeIcon: 'profileActive' },
];

// The FLITO mark in the header's left slot on a tab's first screen. The
// wordmark keeps the true brand amber: WCAG contrast minimums do not apply to
// logotype (see theme/tokens.js primaryText).
export const BrandMark = () => (
  <View style={styles.brand} accessibilityLabel="FLITO">
    <Image source={LOGO} style={styles.logo} resizeMode="contain" accessible={false} />
    <Text style={styles.wordmark}>FLITO</Text>
  </View>
);

const NavLink = ({ link, active }) => {
  const navigation = useNavigation();
  const [hovered, setHovered] = useState(false);
  const user = useSelector((state) => state.auth.user);
  // The Profile link shows the user's own photo once they have one.
  const photo = link.tab === 'Profile' ? user?.avatarUrl : null;

  return (
    <Pressable
      onPress={() => navigation.navigate(link.tab, { screen: link.screen })}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      accessibilityLabel={link.label}
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
      <Text style={[styles.linkText, active && styles.linkTextActive]}>{link.label}</Text>
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

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg },
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
});
