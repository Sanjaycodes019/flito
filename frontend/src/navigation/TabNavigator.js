import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeStackNavigator from './HomeStackNavigator';
import ProfileStackNavigator from './ProfileStackNavigator';
import Icon from '../theme/icons';
import { colors, type } from '../theme/tokens';
import useBreakpoint from '../hooks/useBreakpoint';

const Tab = createBottomTabNavigator();

// Each tab shows its filled icon while active and its outline icon otherwise,
// the same active/inactive language a StatusBadge or Button conveys with
// color: filled and on-brand means "this is where you are."
const TAB_ICON = {
  HomeTab: { active: 'homeActive', inactive: 'home' },
  Profile: { active: 'profileActive', inactive: 'profile' },
};

// A bottom tab bar suits phones and tablets. On a laptop it reads as a phone
// app stretched across the screen, so from desktop width up it is hidden and
// the stack headers carry the Home and Profile links instead
// (see stackScreenOptions).
const TabNavigator = () => {
  const { isDesktop } = useBreakpoint();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // each stack screen sets its own header
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: isDesktop
          ? { display: 'none' }
          : {
            backgroundColor: colors.surface,
            borderTopColor: colors.divider,
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
          },
        tabBarLabelStyle: { fontSize: type.caption.fontSize, fontWeight: '600' },
        tabBarIcon: ({ color, focused, size }) => (
          <Icon name={focused ? TAB_ICON[route.name].active : TAB_ICON[route.name].inactive} size={size ?? 22} color={color} />
        ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
};

export default TabNavigator;
