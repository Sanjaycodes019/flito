import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Icon from '../theme/icons';
import Button from '../components/common/Button';
import { SidebarFrame, SidebarNavItem } from '../components/navigation/Sidebar';
import { colors, spacing, radius, shadow, iconSize } from '../theme/tokens';
import useBreakpoint from '../hooks/useBreakpoint';
import useAdminStats from '../admin/useAdminStats';
import { ADMIN_SECTIONS } from '../admin/sections';
import { ROLE_NAV, isItemActive } from './roleNav';

const BAR_HEIGHT = 62;

// The navigation of the signed-in app, drawn from one place so every role
// looks and behaves alike:
//   phone / tablet   a bottom bar of that role's sections; the profile is the
//                    avatar in the header
//   laptop           a sidebar with the same sections and your account
//                    (admins get theirs from AdminShell, with their pages)
const barItems = ({ role, t, navigation, focusedTab, nestedName, stats }) => {
  if (role === 'admin') {
    return ADMIN_SECTIONS.map((section) => ({
      key: section.key,
      label: t(section.labelKey),
      icon: section.icon,
      active: focusedTab === 'HomeTab' && [section.route, section.alsoAt?.route].includes(nestedName),
      badge: section.badgeStat && stats ? stats[section.badgeStat] : 0,
      onPress: () => navigation.navigate('HomeTab', { screen: section.route }),
    }));
  }
  return (ROLE_NAV[role] || ROLE_NAV.shipper).map((item) => ({
    key: item.key,
    label: t(item.labelKey),
    icon: item.key === 'home' && focusedTab === 'HomeTab' && nestedName === 'Home' ? 'homeActive' : item.icon,
    cta: item.cta,
    active: focusedTab === 'HomeTab' && isItemActive(item, nestedName),
    onPress: () => navigation.navigate('HomeTab', { screen: item.route }),
  }));
};

const TabItem = ({ item }) => {
  if (item.cta) {
    return (
      <Pressable onPress={item.onPress} accessibilityRole="button" accessibilityLabel={item.label} style={styles.item}>
        <View style={styles.cta}>
          <Icon name={item.icon} size={iconSize.lg} color={colors.textOnPrimary} />
        </View>
        <Text style={[styles.label, styles.ctaLabel]} numberOfLines={1}>{item.label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: item.active }}
      accessibilityLabel={item.label}
      style={styles.item}
    >
      <View style={[styles.pill, item.active && styles.pillActive]}>
        <Icon name={item.icon} size={iconSize.lg - 2} color={item.active ? colors.primaryText : colors.textMuted} />
        {item.badge ? (
          <View style={styles.badge}><Text style={styles.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text></View>
        ) : null}
      </View>
      <Text style={[styles.label, item.active && styles.labelActive]} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  );
};

// A role's laptop sidebar, positioned at the left edge (TabNavigator leaves
// room for it).
const RoleSidebar = ({ role, focusedTab, nestedName, navigation }) => {
  const { t } = useTranslation();
  const items = ROLE_NAV[role] || ROLE_NAV.shipper;
  const cta = items.find((item) => item.cta);
  const current = focusedTab === 'Profile' ? 'profile' : nestedName === 'Home' ? 'home' : null;

  return (
    <View style={styles.sidebarWrap}>
      <SidebarFrame
        tagIcon={role}
        tag={t(`profile:roles.${role}`, role)}
        group={t('navigation:menu')}
        current={current}
        action={cta ? (
          <Button title={t(cta.labelKey)} icon={cta.icon} onPress={() => navigation.navigate('HomeTab', { screen: cta.route })} />
        ) : null}
      >
        {items.filter((item) => !item.cta).map((item) => (
          <SidebarNavItem
            key={item.key}
            icon={item.icon}
            label={t(item.labelKey)}
            active={focusedTab === 'HomeTab' && isItemActive(item, nestedName)}
            onPress={() => navigation.navigate('HomeTab', { screen: item.route })}
          />
        ))}
      </SidebarFrame>
    </View>
  );
};

const AppTabBar = ({ state, navigation }) => {
  const { t } = useTranslation();
  const { isDesktop } = useBreakpoint();
  const insets = useSafeAreaInsets();
  const role = useSelector((s) => s.auth.user?.role);
  const isAdmin = role === 'admin';
  const stats = useAdminStats({ passive: isDesktop || !isAdmin });

  const focused = state.routes[state.index];
  const nestedName = focused.name === 'HomeTab' ? getFocusedRouteNameFromRoute(focused) ?? 'Home' : null;

  if (isDesktop) {
    return isAdmin ? null : <RoleSidebar role={role} focusedTab={focused.name} nestedName={nestedName} navigation={navigation} />;
  }

  const items = barItems({ role, t, navigation, focusedTab: focused.name, nestedName, stats });

  return (
    <View style={[styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {items.map((item) => <TabItem key={item.key} item={item} />)}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.xs,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 0 },
  pill: { width: 52, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.primaryMuted },
  cta: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginTop: -14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.level2,
  },
  ctaLabel: { color: colors.primaryText },
  label: { fontSize: 11, fontWeight: '600', color: colors.textMuted, maxWidth: '100%' },
  labelActive: { color: colors.primaryText },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.warningText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.textOnDark },

  // Laptop: pinned to the left edge, full height.
  sidebarWrap: { position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 10, flexDirection: 'row' },
});

export default AppTabBar;
