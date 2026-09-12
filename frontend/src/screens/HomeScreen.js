import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { FLITO_COLORS } from '../utils/colors';
import { ROLES } from '../utils/constants';
import api from '../services/api';
import socketService from '../services/socket';
import { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError, updateLoad } from '../redux/slices/loadsSlice';
import { fetchBookingsStart, fetchBookingsSuccess, fetchBookingsError, updateBooking } from '../redux/slices/bookingSlice';
import { formatCurrency, getErrorMessage } from '../utils/helpers';

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const { items: loads, isLoading: loadsLoading } = useSelector((state) => state.loads);
  const { items: bookings, isLoading: bookingsLoading } = useSelector((state) => state.bookings);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    dispatch(fetchLoadsStart());
    dispatch(fetchBookingsStart());
    try {
      const loadsQuery = user?.role === ROLES.SHIPPER ? '?mine=true' : '';
      const [loadsRes, bookingsRes] = await Promise.all([
        api.get(`/loads${loadsQuery}`),
        api.get('/bookings'),
      ]);
      dispatch(fetchLoadsSuccess(loadsRes.data.loads));
      dispatch(fetchBookingsSuccess(bookingsRes.data.bookings));
    } catch (error) {
      dispatch(fetchLoadsError(getErrorMessage(error)));
      dispatch(fetchBookingsError(getErrorMessage(error)));
    }
  }, [dispatch, user?.role]);

  // Home is the stack root, so it stays mounted while the user works in
  // pushed screens. Refetch whenever it regains focus so the dashboard counts
  // reflect loads posted, quotes accepted, and bookings updated elsewhere.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (token) {
      socketService.connect(token);
      const onNewQuote = ({ load }) => dispatch(updateLoad(load));
      const onBookingChanged = ({ booking }) => dispatch(updateBooking(booking));
      const onQuoteAccepted = ({ booking }) => dispatch(updateBooking(booking));

      socketService.on('new-quote', onNewQuote);
      socketService.on('booking-status-changed', onBookingChanged);
      socketService.on('quote-accepted', onQuoteAccepted);

      return () => {
        socketService.off('new-quote', onNewQuote);
        socketService.off('booking-status-changed', onBookingChanged);
        socketService.off('quote-accepted', onQuoteAccepted);
      };
    }
  }, [token, dispatch]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const activeBookings = bookings.filter((b) => !['completed', 'cancelled'].includes(b.status));
  const todaysEarnings = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.firstName}</Text>
        <Text style={styles.role}>Role: {user?.role}</Text>
      </View>

      {user?.role === ROLES.SHIPPER && (
        <>
          <Card>
            <Text style={styles.cardTitle}>Post a Load</Text>
            <Text style={styles.cardDesc}>Describe your shipment and get quotes from truck owners</Text>
            <Button title="Post Load" onPress={() => navigation.navigate('CreateLoad')} />
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Your Loads ({loads.length})</Text>
            <Text style={styles.cardDesc}>
              {loadsLoading ? 'Loading…' : loads.filter((l) => l.status === 'open' || l.status === 'quoted').length + ' awaiting quotes'}
            </Text>
            <Button title="View My Loads" variant="secondary" onPress={() => navigation.navigate('LoadsList')} />
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Active Bookings ({activeBookings.length})</Text>
            <Text style={styles.cardDesc}>Track pickup, delivery, and driver location</Text>
            <Button title="View Bookings" variant="secondary" onPress={() => navigation.navigate('Bookings')} />
          </Card>
        </>
      )}

      {user?.role === ROLES.OWNER && (
        <>
          <Card>
            <Text style={styles.cardTitle}>Available Loads ({loads.length})</Text>
            <Text style={styles.cardDesc}>Find new shipping opportunities and submit quotes</Text>
            <Button title="Browse Loads" onPress={() => navigation.navigate('LoadsList')} />
          </Card>
          <Card>
            <Text style={styles.cardTitle}>My Bookings ({activeBookings.length} active)</Text>
            <Text style={styles.cardDesc}>Assign drivers and track jobs you've won</Text>
            <Button title="View Bookings" variant="secondary" onPress={() => navigation.navigate('Bookings')} />
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Driver Directory</Text>
            <Text style={styles.cardDesc}>Look up a driver by phone before assigning them</Text>
            <Button title="Find a Driver" variant="secondary" onPress={() => navigation.navigate('Fleet')} />
          </Card>
        </>
      )}

      {user?.role === ROLES.DRIVER && (
        <>
          <Card>
            <Text style={styles.cardTitle}>Active Jobs ({activeBookings.length})</Text>
            <Text style={styles.cardDesc}>{bookingsLoading ? 'Loading…' : 'Jobs assigned to you'}</Text>
            <Button title="View Jobs" onPress={() => navigation.navigate('Jobs')} />
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Earnings</Text>
            <Text style={styles.earnings}>{formatCurrency(todaysEarnings)}</Text>
            <Button title="Earnings History" variant="secondary" onPress={() => navigation.navigate('Earnings')} />
          </Card>
        </>
      )}

      {user?.role === ROLES.ADMIN && (
        <Card>
          <Text style={styles.cardTitle}>Admin Dashboard</Text>
          <Text style={styles.cardDesc}>KYC approvals, disputes, platform metrics</Text>
          <Button title="Open Dashboard" onPress={() => navigation.navigate('AdminDashboard')} />
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background, padding: 16 },
  header: { marginBottom: 24, marginTop: 8 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: FLITO_COLORS.secondary },
  role: { fontSize: 14, color: FLITO_COLORS.textMuted, marginTop: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: FLITO_COLORS.secondary, marginBottom: 8 },
  cardDesc: { fontSize: 13, color: FLITO_COLORS.textMuted, marginBottom: 12 },
  earnings: { fontSize: 24, fontWeight: 'bold', color: FLITO_COLORS.primary, marginVertical: 12 },
});

export default HomeScreen;
