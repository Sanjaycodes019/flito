import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ActionTile from '../components/home/ActionTile';
import Grid from '../components/common/Grid';
import Avatar from '../components/common/Avatar';
import VerifiedBadge from '../components/common/VerifiedBadge';
import VerificationPrompt from '../components/kyc/VerificationPrompt';
import EmailVerificationPrompt from '../components/auth/EmailVerificationPrompt';
import Icon from '../theme/icons';
import { colors, spacing, radius, shadow, type, iconSize, themedStyles } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import useScreenLayout from '../hooks/useScreenLayout';
import api from '../services/api';
import { authService } from '../services/auth';
import socketService from '../services/socket';
import { setUser } from '../redux/slices/authSlice';
import { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError, updateLoad } from '../redux/slices/loadsSlice';
import { fetchBookingsStart, fetchBookingsSuccess, fetchBookingsError, updateBooking } from '../redux/slices/bookingSlice';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import { isTurnOf } from '../utils/negotiation';

const StatTile = ({ icon, label, value }) => (
  <View style={styles.stat}>
    <View style={styles.statHeader}>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.statIcon}>
        <Icon name={icon} size={iconSize.sm} color={colors.primaryText} />
      </View>
    </View>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const { items: loads, isLoading: loadsLoading } = useSelector((state) => state.loads);
  const { items: bookings, isLoading: bookingsLoading } = useSelector((state) => state.bookings);
  const [refreshing, setRefreshing] = useState(false);
  const [myQuotes, setMyQuotes] = useState([]);
  const layout = useScreenLayout('wide');

  const isShipper = user?.role === ROLES.SHIPPER;
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

  const { isPhone } = layout;
  const roleSubtitle = user?.role ? t(`common:home.roleSubtitle.${user.role}`, '') : '';

  const needsVerification = (isOwner || isDriver) && user?.kycStatus !== 'approved';
  const activeBookings = bookings.filter((b) => !['completed', 'cancelled'].includes(b.status));
  const completedBookings = bookings.filter((b) => b.status === 'completed').length;
  const awaitingQuotes = loads.filter((l) => l.status === 'open' || l.status === 'quoted').length;
  // Booking requests and shipper counter-offers waiting on the owner to reply.
  const awaitingMyResponse = myQuotes.filter((q) => isTurnOf(q, 'owner')).length;
  const todaysEarnings = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // A dash instead of a misleading 0 while the first fetch is still running.
  const count = (n, loading) => (loading && n === 0 ? '-' : String(n));

  // Big picture buttons instead of paragraphs. The first tile of each role is
  // its main job and spans the row; a number says how much is waiting.
  const go = (route) => () => navigation.navigate(route);
  const tile = (key, icon, badge, route, extra = {}) => (
    <ActionTile key={key} icon={icon} title={t(`common:home.tiles.${key}`)} badge={badge} onPress={go(route)} {...extra} />
  );
  let mainTile = null;
  const tiles = [];
  if (isShipper) {
    mainTile = tile('postLoad', 'load', null, 'CreateLoad', { primary: true });
    tiles.push(
      tile('myLoads', 'document', awaitingQuotes, 'LoadsList'),
      tile('bookings', 'truckDelivery', activeBookings.length, 'Bookings'),
    );
  }
  if (isOwner) {
    mainTile = tile('findLoads', 'search', null, 'LoadsList', { primary: true });
    tiles.push(
      tile('offers', 'quote', awaitingMyResponse, 'MyQuotes'),
      tile('bookings', 'truckDelivery', activeBookings.length, 'Bookings'),
      tile('myTrucks', 'fleet', null, 'Fleet'),
    );
  }
  if (isDriver) {
    // One job under way (the usual case): the big button opens it straight
    // to its next step, instead of a list with one thing in it.
    const [onlyJob] = activeBookings.length === 1 ? activeBookings : [];
    mainTile = onlyJob ? (
      <ActionTile
        key="continueJob"
        icon="truckDelivery"
        title={t('common:home.tiles.continueJob')}
        detail={[
          onlyJob.loadId?.goodsType,
          [onlyJob.loadId?.pickupLocation, onlyJob.loadId?.dropoffLocation].map((stop) => stop?.label || stop?.address).filter(Boolean).join(' → '),
        ].filter(Boolean).join(' · ')}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: onlyJob._id })}
        primary
      />
    ) : tile('myJobs', 'jobs', activeBookings.length, 'Jobs', { primary: true });
    if (onlyJob) tiles.push(tile('myJobs', 'jobs', null, 'Jobs'));
    tiles.push(tile('earnings', 'earnings', null, 'Earnings', { value: formatCurrency(todaysEarnings) }));
  }
  if (user?.role === ROLES.ADMIN) {
    mainTile = tile('admin', 'admin', null, 'AdminUsers', { primary: true });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={[styles.header, !isPhone && styles.headerWide]}>
        <Avatar
          uri={user?.avatarUrl}
          role={user?.role}
          size={isPhone ? 52 : 64}
          style={[styles.avatar, !isPhone && styles.avatarWide]}
        />
        <View style={styles.headerText}>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, !isPhone && styles.greetingWide]}>{t('common:home.greeting', { firstName: user?.firstName })}</Text>
            {user?.kycStatus === 'approved' && <VerifiedBadge size={isPhone ? 22 : 26} label={t('common:home.verifiedByFlito')} />}
            <View style={styles.roleChip}>
              <Text style={styles.roleText}>{t(`profile:roles.${user?.role}`, user?.role)}</Text>
            </View>
          </View>
          {!!roleSubtitle && <Text style={styles.subtitle}>{roleSubtitle}</Text>}
        </View>
      </View>

      {user?.email && !user?.emailVerified && (
        <EmailVerificationPrompt email={user.email} />
      )}

      {needsVerification && (
        <VerificationPrompt
          kycStatus={user?.kycStatus}
          message={isOwner
            ? t('common:home.ownerVerificationMessage')
            : t('common:home.driverVerificationMessage')}
        />
      )}

      {mainTile && <View style={styles.mainTile}>{mainTile}</View>}
      {tiles.length > 0 && <Grid columns={isPhone ? 1 : 2} gap={spacing.md}>{tiles}</Grid>}

      {isShipper && (
        <>
          <Text style={styles.sectionLabel}>{t('common:home.overview')}</Text>
          <Grid columns={isPhone ? 2 : 4} gap={isPhone ? spacing.md : spacing.lg}>
            <StatTile key="loads" icon="load" label={t('common:home.totalLoads')} value={count(loads.length, loadsLoading)} />
            <StatTile key="awaiting" icon="quote" label={t('common:home.awaitingQuotes')} value={count(awaitingQuotes, loadsLoading)} />
            <StatTile key="active" icon="truckDelivery" label={t('common:home.activeBookings')} value={count(activeBookings.length, bookingsLoading)} />
            <StatTile key="completed" icon="success" label={t('common:home.completed')} value={count(completedBookings, bookingsLoading)} />
          </Grid>
        </>
      )}

    </ScrollView>
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },

  // Greeting: a plain row on phones, a header card from tablet width up.
  header: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  headerWide: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    marginTop: 0,
    marginBottom: spacing.sm,
    ...shadow.level1,
  },
  avatar: { marginRight: spacing.md },
  avatarWide: { marginRight: spacing.lg },
  headerText: { flex: 1, minWidth: 0 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  greeting: { ...type.h2, color: colors.textPrimary },
  greetingWide: { ...type.display },
  roleChip: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  roleText: { ...type.caption, color: colors.primaryText, textTransform: 'capitalize' },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  mainTile: { marginBottom: spacing.md },

  sectionLabel: {
    ...type.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.level1,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { ...type.small, color: colors.textMuted, flex: 1, marginRight: spacing.sm },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { ...type.h1, color: colors.textPrimary, marginTop: spacing.xs },
}));

export default HomeScreen;
