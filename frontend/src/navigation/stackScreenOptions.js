import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, type } from '../theme/tokens';
import { BrandMark, ProfileButton } from '../components/navigation/DesktopNav';
import LanguageToggle from '../components/common/LanguageToggle';
import { ADMIN_SECTIONS } from '../admin/sections';
import { ROLE_NAV } from './roleNav';

// Admin sections are top-level places, reached from the bottom bar or the
// sidebar rather than pushed from another screen, so they are treated like a
// tab's first screen: the FLITO mark instead of a back arrow.
const ADMIN_ROUTES = ADMIN_SECTIONS.flatMap((section) => [section.route, section.alsoAt?.route].filter(Boolean));

// The pages each role's bottom bar / sidebar opens. Like admin sections they are
// top-level places, so on a phone they lead with the FLITO mark, not a back arrow.
const NAV_ROUTES = Object.values(ROLE_NAV).flat().map((item) => item.route);

// Right side of the header. On a laptop the sidebar carries the language switch
// and account, so it is empty. On a phone or tablet: the language switch (first
// screens only on a phone, to leave the title room) and your avatar, which opens
// Profile.
const HeaderRight = ({ isDesktop, isPhone, isRoot }) => {
  if (isDesktop) return null;
  return (
    <View style={styles.headerRight}>
      {(!isPhone || isRoot) && <LanguageToggle compact />}
      <ProfileButton />
    </View>
  );
};

// The header look shared by both tab stacks: the FLITO mark on a tab's first
// screen (other screens keep their back arrow), then the title, then the
// controls from HeaderRight. On a phone the first screens of the Home stack (Home
// and the admin sections) drop the title: the mark already says FLITO and the
// page has its own heading.
const stackScreenOptions = ({ isDesktop, isPhone = false, isAdmin = false, activeTab, rootScreen }) => ({ route }) => {
  const isRoot = route.name === rootScreen || ADMIN_ROUTES.includes(route.name) || (activeTab === 'HomeTab' && NAV_ROUTES.includes(route.name));
  const dropsTitle = route.name === rootScreen || ADMIN_ROUTES.includes(route.name);
  return {
    headerTintColor: colors.primaryText,
    headerStyle: { backgroundColor: colors.surface },
    headerTitleStyle: { color: colors.textPrimary, fontSize: type.h3.fontSize, fontWeight: type.h3.fontWeight },
    headerShadowVisible: isDesktop,
    contentStyle: { backgroundColor: colors.background },
    headerRight: () => <HeaderRight isDesktop={isDesktop} isPhone={isPhone} isRoot={isRoot} />,
    // The FLITO mark leads a first screen on a phone or tablet; on a laptop it is in the sidebar.
    ...(isRoot && !isDesktop ? { headerLeft: () => <BrandMark /> } : {}),
    // On a laptop the admin pages are a console with its own sidebar (brand, sections,
    // account), so the generic top bar would only repeat it.
    ...(isDesktop && (ADMIN_ROUTES.includes(route.name) || (isAdmin && route.name === rootScreen)) ? { headerShown: false } : {}),
    ...(dropsTitle && isPhone && activeTab === 'HomeTab' ? { headerTitle: '' } : {}),
  };
};

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

export default stackScreenOptions;
