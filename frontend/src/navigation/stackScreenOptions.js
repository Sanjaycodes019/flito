import React from 'react';
import { colors, type } from '../theme/tokens';
import { BrandMark, TopNavLinks } from '../components/navigation/DesktopNav';

// The header look shared by both tab stacks. On desktop the bottom tab bar is
// hidden (see TabNavigator), so the header becomes the app's top bar: the
// FLITO mark on a tab's first screen (other screens keep their back arrow)
// and the Home and Profile links on the right.
const stackScreenOptions = ({ isDesktop, activeTab, rootScreen }) => ({ route }) => ({
  headerTintColor: colors.primaryText,
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.textPrimary, fontSize: type.h3.fontSize, fontWeight: type.h3.fontWeight },
  headerShadowVisible: isDesktop,
  contentStyle: { backgroundColor: colors.background },
  ...(isDesktop ? { headerRight: () => <TopNavLinks activeTab={activeTab} /> } : {}),
  ...(isDesktop && route.name === rootScreen ? { headerLeft: () => <BrandMark /> } : {}),
});

export default stackScreenOptions;
