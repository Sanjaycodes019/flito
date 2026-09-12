import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeStackNavigator from './HomeStackNavigator';
import ProfileScreen from '../screens/ProfileScreen';
import { FLITO_COLORS } from '../utils/colors';

const Tab = createBottomTabNavigator();

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false, // each stack screen sets its own header
      tabBarActiveTintColor: FLITO_COLORS.primary,
      tabBarInactiveTintColor: FLITO_COLORS.textMuted,
    }}
  >
    <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true }} />
  </Tab.Navigator>
);

export default TabNavigator;
