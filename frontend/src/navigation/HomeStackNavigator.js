import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import HomeScreen from '../screens/HomeScreen';
import CreateLoadScreen from '../screens/shipper/CreateLoadScreen';
import TruckMatchesScreen from '../screens/shipper/TruckMatchesScreen';
import LoadsListScreen from '../screens/LoadsListScreen';
import LoadDetailScreen from '../screens/LoadDetailScreen';
import BookingsListScreen from '../screens/BookingsListScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';
import ManageFleet from '../screens/owner/ManageFleet';
import MyQuotesScreen from '../screens/owner/MyQuotesScreen';
import EarningsScreen from '../screens/driver/EarningsScreen';
import { renderAdminScreens, AdminHome } from '../admin/navigation';
import useBreakpoint from '../hooks/useBreakpoint';
import stackScreenOptions from './stackScreenOptions';

const Stack = createNativeStackNavigator();

// Every role-specific destination HomeScreen links to lives here as one
// stack, so the Home tab can push into loads/bookings/fleet/admin flows
// while Profile stays a separate, simple tab.
const HomeStackNavigator = () => {
  const { isDesktop, isPhone } = useBreakpoint();
  const isAdmin = useSelector((state) => state.auth.user?.role) === 'admin';
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={stackScreenOptions({ isDesktop, isPhone, isAdmin, activeTab: 'HomeTab', rootScreen: 'Home' })}>
      {/* On desktop the FLITO mark already sits in the header's left slot. */}
      <Stack.Screen name="Home" component={isAdmin ? AdminHome : HomeScreen} options={{ title: isDesktop ? t('navigation:homeStack.dashboard') : t('navigation:homeStack.home') }} />
      <Stack.Screen name="CreateLoad" component={CreateLoadScreen} options={{ title: t('navigation:homeStack.createLoad') }} />
      <Stack.Screen name="TruckMatches" component={TruckMatchesScreen} options={{ title: t('navigation:homeStack.truckMatches') }} />
      <Stack.Screen name="LoadsList" component={LoadsListScreen} options={{ title: t('navigation:homeStack.loadsList') }} />
      <Stack.Screen name="LoadDetail" component={LoadDetailScreen} options={{ title: t('navigation:homeStack.loadDetail') }} />
      <Stack.Screen name="Bookings" component={BookingsListScreen} options={{ title: t('navigation:homeStack.bookings') }} />
      <Stack.Screen name="Jobs" component={BookingsListScreen} options={{ title: t('navigation:homeStack.jobs') }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: t('navigation:homeStack.bookingDetail') }} />
      <Stack.Screen name="MyQuotes" component={MyQuotesScreen} options={{ title: t('navigation:homeStack.myQuotes') }} />
      <Stack.Screen name="Fleet" component={ManageFleet} options={{ title: t('navigation:homeStack.fleet') }} />
      <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: t('navigation:homeStack.earnings') }} />
      {renderAdminScreens(Stack, t)}
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
