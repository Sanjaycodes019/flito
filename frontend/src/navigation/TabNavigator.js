import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import HomeStackNavigator from './HomeStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
import AppTabBar from './AppTabBar';
import { SIDEBAR_WIDTH } from '../components/navigation/Sidebar';
import useBreakpoint from '../hooks/useBreakpoint';

const Tab = createBottomTabNavigator();

// Two tabs, Home and Profile, drawn by AppTabBar: a bottom bar on phones and
// tablets, a sidebar on a laptop. The sidebar is pinned over the left edge, so
// on a laptop the pages are pushed right to clear it. (Admins draw their own
// sidebar inside each admin page, so they need no gap.)
const TabNavigator = () => {
  const { t } = useTranslation();
  const { isDesktop } = useBreakpoint();
  const isAdmin = useSelector((state) => state.auth.user?.role) === 'admin';

  return (
    <Tab.Navigator
      tabBar={(props) => <AppTabBar {...props} />}
      sceneContainerStyle={isDesktop && !isAdmin ? { paddingLeft: SIDEBAR_WIDTH } : undefined}
      screenOptions={{ headerShown: false }} // each stack screen sets its own header
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: t('navigation:tabs.home') }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: t('navigation:tabs.profile') }} />
    </Tab.Navigator>
  );
};

export default TabNavigator;
