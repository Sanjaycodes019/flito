import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import useScreenLayout from '../hooks/useScreenLayout';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize, themedStyles } from '../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { fetchBookingsStart, fetchBookingsSuccess, fetchBookingsError } from '../redux/slices/bookingSlice';

const BookingsListScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { items: bookings, isLoading, error } = useSelector((state) => state.bookings);
  const [refreshing, setRefreshing] = useState(false);
  const layout = useScreenLayout('wide');
  const columns = layout.isPhone ? 1 : layout.isDesktop ? 3 : 2;

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
      // A mounted list can't change its column count, so a new count remounts it.
      key={`columns-${columns}`}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
      style={styles.container}
      contentContainerStyle={[styles.content, layout.contentStyle]}
      data={bookings}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState icon="truckDelivery" title={t('bookings:list.emptyTitle')} message={t('bookings:list.emptyMessage')} />
      }
      renderItem={({ item }) => (
        <View style={columns > 1 ? [styles.cell, { width: `${100 / columns}%` }] : null}>
          <Card
            style={[styles.card, columns > 1 && styles.cardInGrid]}
            containerStyle={columns > 1 ? styles.fill : undefined}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}
            accessibilityLabel={t('bookings:list.accessibilityBooking', { goodsType: item.loadId?.goodsType || t('bookings:list.loadFallback') })}
          >
            <View style={styles.row}>
              <Text style={styles.goodsType} numberOfLines={1}>{item.loadId?.goodsType || t('bookings:list.loadFallback')}</Text>
              <StatusBadge status={item.status} />
            </View>
            <View style={styles.routeRow}>
              <Icon name="pickup" size={iconSize.xs} color={colors.textMuted} />
              <Text style={styles.route} numberOfLines={1}>{item.loadId?.pickupLocation?.label || item.loadId?.pickupLocation?.address}</Text>
              <Icon name="forward" size={iconSize.xs} color={colors.textMuted} />
              <Icon name="dropoff" size={iconSize.xs} color={colors.textMuted} />
              <Text style={styles.route} numberOfLines={1}>{item.loadId?.dropoffLocation?.label || item.loadId?.dropoffLocation?.address}</Text>
            </View>
            <View style={styles.rowBottom}>
              <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
          </Card>
        </View>
      )}
    />
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  card: { marginVertical: spacing.xs },
  // Grid layout: each cell carries half the gutter on both sides.
  columnRow: { marginHorizontal: -spacing.sm },
  cell: { paddingHorizontal: spacing.sm },
  cardInGrid: { flex: 1, marginVertical: spacing.sm },
  fill: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, flexWrap: 'wrap' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  goodsType: { ...type.h3, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  route: { ...type.small, color: colors.textMuted },
  amount: { ...type.bodyMedium, color: colors.primaryText },
  date: { ...type.small, color: colors.textMuted },
}));

export default BookingsListScreen;
