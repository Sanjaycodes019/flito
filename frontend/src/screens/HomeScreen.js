import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import DashboardCard from '../components/home/DashboardCard';
import VerificationPrompt from '../components/kyc/VerificationPrompt';
import EmailVerificationPrompt from '../components/auth/EmailVerificationPrompt';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import api from '../services/api';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { setUser } from '../redux/slices/authSlice';
import { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError, updateLoad } from '../redux/slices/loadsSlice';
import { fetchBookingsStart, fetchBookingsSuccess, fetchBookingsError, updateBooking } from '../redux/slices/bookingSlice';
import { formatCurrency, getErrorMessage } from '../utils/helpers';

const ROLE_ICON = {
  [ROLES.SHIPPER]: 'shipper',
  [ROLES.OWNER]: 'owner',
  [ROLES.DRIVER]: 'driver',
  [ROLES.ADMIN]: 'admin',
};

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const { items: loads, isLoading: loadsLoading } = useSelector((state) => state.loads);
  const { items: bookings, isLoading: bookingsLoading } = useSelector((state) => state.bookings);
  const [refreshing, setRefreshing] = useState(false);
  const [myQuotes, setMyQuotes] = useState([]);

  const isOwner = user?.role === ROLES.OWNER;
  const isDriver = user?.role === ROLES.DRIVER;

  const loadData = useCallback(async () => {
    dispatch(fetchLoadsStart());
    dispatch(fetchBookingsStart());
    try {
      const loadsQuery = user?.role === ROLES.SHIPPER ? '?mine=true' : '';
      const [loadsRes, bookingsRes, quotesRes] = await Promise.all([
        api.get(`/loads${loadsQuery}`),
        api.get('/bookings'),
        isOwner ? api.get('/quotes/mine') : Promise.resolve(null),
      ]);
      dispatch(fetchLoadsSuccess(loadsRes.data.loads));
      dispatch(fetchBookingsSuccess(bookingsRes.data.bookings));
      if (quotesRes) setMyQuotes(quotesRes.data.quotes);
    } catch (error) {
      dispatch(fetchLoadsError(getErrorMessage(error)));
      dispatch(fetchBookingsError(getErrorMessage(error)));
    }
  }, [dispatch, user?.role, isOwner]);

  // Home is the stack root, so it stays mounted while the user works in
  // pushed screens. Refetch whenever it regains focus so the dashboard counts
  // reflect loads posted, quotes accepted, and bookings updated elsewhere,
  // and so a verification decided in the meantime shows up.
  useFocusEffect(
    useCallback(() => {
      loadData();
      authService.me().then(({ user: fresh }) => dispatch(setUser(fresh))).catch(() => {});
    }, [loadData, dispatch])
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

  const needsVerification = (isOwner || isDriver) && user?.kycStatus !== 'approved';
  const activeBookings = bookings.filter((b) => !['completed', 'cancelled'].includes(b.status));
  // Quotes where the shipper has countered are waiting on the owner to reply.
  const awaitingMyResponse = myQuotes.filter(
    (q) => q.status === 'countered' && q.counterOfferBy === 'shipper'
  ).length;
  const todaysEarnings = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Icon name={ROLE_ICON[user?.role] || 'person'} size={iconSize.lg} color={colors.textOnDark} />
        </View>
        <View>
          <Text style={styles.greeting}>Hello, {user?.firstName}</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>
        </View>
      </View>

      {user?.email && !user?.emailVerified && (
        <EmailVerificationPrompt email={user.email} />
      )}

      {needsVerification && (
        <VerificationPrompt
          kycStatus={user?.kycStatus}
          message={isOwner
            ? 'Owners need a verified identity to submit quotes and win bookings. You can still browse loads.'
            : 'Drivers need a verified identity before an owner can assign them to a job.'}
        />
      )}

      {user?.role === ROLES.SHIPPER && (
        <>
          <DashboardCard
            icon="load"
            title="Post a Load"
            description="Describe your shipment and get quotes from truck owners"
            actionLabel="Post Load"
            onAction={() => navigation.navigate('CreateLoad')}
          />
          <DashboardCard
            icon="document"
            title={`Your Loads (${loads.length})`}
            description={loadsLoading ? 'Loading...' : `${loads.filter((l) => l.status === 'open' || l.status === 'quoted').length} awaiting quotes`}
            actionLabel="View My Loads"
            variant="secondary"
            onAction={() => navigation.navigate('LoadsList')}
          />
          <DashboardCard
            icon="truckDelivery"
            title={`Active Bookings (${activeBookings.length})`}
            description="Track pickup, delivery, and driver location"
            actionLabel="View Bookings"
            variant="secondary"
            onAction={() => navigation.navigate('Bookings')}
          />
        </>
      )}

      {isOwner && (
        <>
          <DashboardCard
            icon="search"
            title={`Available Loads (${loads.length})`}
            description="Find new shipping opportunities and submit quotes"
            actionLabel="Browse Loads"
            onAction={() => navigation.navigate('LoadsList')}
          />
          <DashboardCard
            icon="quote"
            title="My Quotes"
            description={awaitingMyResponse > 0 ? `${awaitingMyResponse} awaiting your response` : 'Track the loads you have bid on'}
            actionLabel="View My Quotes"
            variant="secondary"
            onAction={() => navigation.navigate('MyQuotes')}
          />
          <DashboardCard
            icon="truckDelivery"
            title={`My Bookings (${activeBookings.length} active)`}
            description="Assign drivers and track jobs you've won"
            actionLabel="View Bookings"
            variant="secondary"
            onAction={() => navigation.navigate('Bookings')}
          />
          <DashboardCard
            icon="fleet"
            title="My Fleet"
            description="Manage your trucks and their assigned drivers"
            actionLabel="Manage Fleet"
            variant="secondary"
            onAction={() => navigation.navigate('Fleet')}
          />
        </>
      )}

      {isDriver && (
        <>
          <DashboardCard
            icon="jobs"
            title={`Active Jobs (${activeBookings.length})`}
            description={bookingsLoading ? 'Loading...' : 'Jobs assigned to you'}
            actionLabel="View Jobs"
            onAction={() => navigation.navigate('Jobs')}
          />
          <DashboardCard
            icon="earnings"
            title="Earnings"
            value={formatCurrency(todaysEarnings)}
            actionLabel="Earnings History"
            variant="secondary"
            onAction={() => navigation.navigate('Earnings')}
          />
        </>
      )}

      {user?.role === ROLES.ADMIN && (
        <DashboardCard
          icon="admin"
          title="Admin Dashboard"
          description="KYC approvals, disputes, platform metrics"
          actionLabel="Open Dashboard"
          onAction={() => navigation.navigate('AdminDashboard')}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, marginTop: spacing.xs },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  greeting: { ...type.h1, color: colors.secondary },
  roleChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xxs,
  },
  roleText: { ...type.caption, color: colors.primaryText, textTransform: 'capitalize' },
});

export default HomeScreen;
