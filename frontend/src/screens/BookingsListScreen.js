import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import RecordCard, { Fact, Pill, RouteLine } from '../components/common/RecordCard';
import { CardCell, cardGridProps, useCardColumns } from '../components/common/CardGrid';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import useScreenLayout from '../hooks/useScreenLayout';
import { colors, themedStyles } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import { dayLabel } from '../utils/nepalDate';
import api from '../services/api';
import { fetchBookingsStart, fetchBookingsSuccess, fetchBookingsError } from '../redux/slices/bookingSlice';

const BookingsListScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { items: bookings, isLoading, error } = useSelector((state) => state.bookings);
  const [refreshing, setRefreshing] = useState(false);
  const layout = useScreenLayout('wide');
  const columns = useCardColumns();
  const role = useSelector((state) => state.auth.user?.role);

  const load = useCallback(async () => {
    dispatch(fetchBookingsStart());
    try {
      const { data } = await api.get('/bookings');
      dispatch(fetchBookingsSuccess(data.bookings));
    } catch (error) {
      dispatch(fetchBookingsError(getErrorMessage(error)));
    }
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (isLoading && !refreshing && bookings.length === 0) return <Spinner />;

  if (error && bookings.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState icon="offline" tone="error" title={t('bookings:list.couldNotLoadTitle')} message={error} actionLabel={t('bookings:list.tryAgain')} onAction={load} />
      </View>
    );
  }

  return (
    <FlatList
      key={`columns-${columns}`}
      {...cardGridProps(columns)}
      style={styles.container}
      contentContainerStyle={[styles.content, layout.contentStyle]}
      data={bookings}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState icon="truckDelivery" title={t('bookings:list.emptyTitle')} message={t('bookings:list.emptyMessage')} />
      }
      renderItem={({ item }) => {
        const load = item.loadId || {};
        const goodsType = load.goodsType || t('bookings:list.loadFallback');
        return (
          <CardCell columns={columns}>
            <RecordCard
              icon="truckDelivery"
              title={goodsType}
              subtitle={item.truckId?.registrationNumber || null}
              badges={(
                <>
                  <StatusBadge status={item.status} />
                  {item.totalAmount ? <Pill icon="price" tone="accent">{formatCurrency(item.totalAmount)}</Pill> : null}
                </>
              )}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
              accessibilityLabel={t('bookings:list.accessibilityBooking', { goodsType })}
            >
              <RouteLine
                from={load.pickupLocation?.label || load.pickupLocation?.address}
                to={load.dropoffLocation?.label || load.dropoffLocation?.address}
              />
              {role !== ROLES.SHIPPER ? <Fact icon="shipper" label={t('bookings:detail.shipper')}>{nameOf(item.shipperId) || '—'}</Fact> : null}
              {role !== ROLES.OWNER ? <Fact icon="owner" label={t('bookings:detail.owner')}>{nameOf(item.ownerId) || '—'}</Fact> : null}
              {role !== ROLES.DRIVER ? (
                <Fact icon="driver" label={t('bookings:detail.driver')} tone={item.driverId ? undefined : 'warning'}>
                  {item.driverId ? nameOf(item.driverId) : t('bookings:detail.notAssigned')}
                </Fact>
              ) : null}
              <Fact icon="calendar" label={t('common:card.pickup')}>{load.pickupDay ? dayLabel(load.pickupDay) : null}</Fact>
              <Fact icon="time" label={t('common:card.booked')}>{formatDate(item.createdAt)}</Fact>
            </RecordCard>
          </CardCell>
        );
      }}
    />
  );
};

// A company name when there is one, otherwise the person's own name.
const nameOf = (person) => person?.companyName || [person?.firstName, person?.lastName].filter(Boolean).join(' ');

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
}));

export default BookingsListScreen;
