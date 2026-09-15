import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import CreateLoadScreen from '../screens/shipper/CreateLoadScreen';
import LoadsListScreen from '../screens/LoadsListScreen';
import LoadDetailScreen from '../screens/LoadDetailScreen';
import BookingsListScreen from '../screens/BookingsListScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';
import ManageFleet from '../screens/owner/ManageFleet';
import MyQuotesScreen from '../screens/owner/MyQuotesScreen';
import EarningsScreen from '../screens/driver/EarningsScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import useBreakpoint from '../hooks/useBreakpoint';
import stackScreenOptions from './stackScreenOptions';

const Stack = createNativeStackNavigator();

// Every role-specific destination HomeScreen links to lives here as one
// stack, so the Home tab can push into loads/bookings/fleet/admin flows
// while Profile stays a separate, simple tab.
const HomeStackNavigator = () => {
  const { isDesktop } = useBreakpoint();

  return (
    <Stack.Navigator screenOptions={stackScreenOptions({ isDesktop, activeTab: 'HomeTab', rootScreen: 'Home' })}>
      {/* On desktop the FLITO mark already sits in the header's left slot. */}
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: isDesktop ? 'Dashboard' : 'FLITO' }} />
      <Stack.Screen name="CreateLoad" component={CreateLoadScreen} options={{ title: 'Post a Load' }} />
      <Stack.Screen name="LoadsList" component={LoadsListScreen} options={{ title: 'Loads' }} />
      <Stack.Screen name="LoadDetail" component={LoadDetailScreen} options={{ title: 'Load Details' }} />
      <Stack.Screen name="Bookings" component={BookingsListScreen} options={{ title: 'Bookings' }} />
      <Stack.Screen name="Jobs" component={BookingsListScreen} options={{ title: 'My Jobs' }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking Details' }} />
      <Stack.Screen name="MyQuotes" component={MyQuotesScreen} options={{ title: 'My Quotes' }} />
      <Stack.Screen name="Fleet" component={ManageFleet} options={{ title: 'My Fleet' }} />
      <Stack.Screen name="Earnings" component={EarningsScreen} options={{ title: 'Earnings' }} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Dashboard' }} />
    </Stack.Navigator>
  );
};

export default HomeStackNavigator;
