import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize } from '../theme/tokens';
import { ROLES, TRUCK_TYPES } from '../utils/constants';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError } from '../redux/slices/loadsSlice';

const TRUCK_TYPE_FILTERS = ['all', ...TRUCK_TYPES];

const LoadsListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { items: loads, isLoading, error } = useSelector((state) => state.loads);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [truckType, setTruckType] = useState('all');

  const isShipper = user?.role === ROLES.SHIPPER;

  const load = useCallback(async () => {
    dispatch(fetchLoadsStart());
    try {
      // Owners get the server's default browse: every load still taking bids.
      const q = isShipper ? '?mine=true' : '';
      const { data } = await api.get(`/loads${q}`);
      dispatch(fetchLoadsSuccess(data.loads));
    } catch (error) {
      dispatch(fetchLoadsError(getErrorMessage(error)));
    }
  }, [dispatch, isShipper]);

  useEffect(() => {
    navigation.setOptions({ title: isShipper ? 'My Loads' : 'Available Loads' });
    load();
  }, [load, navigation, isShipper]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Filtered in memory over the page already fetched (the server caps a
  // browse response at 100 loads), rather than a new search API, since this
  // is a UI-layer addition, not a change to the marketplace's data contract.
  const filteredLoads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return loads.filter((item) => {
      if (truckType !== 'all' && item.truckTypePreference !== truckType) return false;
      if (!needle) return true;
      const haystack = [item.goodsType, item.pickupLocation?.address, item.dropoffLocation?.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [loads, query, truckType]);

  const isFiltering = query.trim().length > 0 || truckType !== 'all';

  if (isLoading && !refreshing && loads.length === 0) return <Spinner />;

  if (error && loads.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState icon="offline" tone="error" title="Could not load this" message={error} actionLabel="Try Again" onAction={load} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={filteredLoads}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        loads.length > 0 && (
          <View style={styles.filters}>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search by goods type or location"
              icon="search"
              containerStyle={styles.searchInput}
            />
            <View style={styles.chipRow}>
              {TRUCK_TYPE_FILTERS.map((t) => (
                <Button
                  key={t}
                  title={t === 'all' ? 'All Trucks' : t}
                  size="sm"
                  variant={truckType === t ? 'primary' : 'tertiary'}
                  onPress={() => setTruckType(t)}
                  style={styles.chip}
                />
              ))}
            </View>
          </View>
        )
      }
      ListEmptyComponent={
        <EmptyState
          icon={isFiltering ? 'search' : 'load'}
          title={isFiltering ? 'No matches' : isShipper ? 'No loads yet' : 'No open loads right now'}
          message={
            isFiltering
              ? 'No loads match your search or filter. Try clearing them.'
              : isShipper
                ? "You haven't posted any loads yet. Post one to start getting quotes."
                : 'Check back soon, or widen your search.'
          }
          actionLabel={isFiltering ? 'Clear Filters' : undefined}
          onAction={isFiltering ? () => { setQuery(''); setTruckType('all'); } : undefined}
        />
      }
      renderItem={({ item }) => (
        <Card style={styles.card} onPress={() => navigation.navigate('LoadDetail', { loadId: item._id })} accessibilityLabel={`${item.goodsType} load`}>
          <View style={styles.row}>
            <Text style={styles.goodsType} numberOfLines={1}>{item.goodsType}</Text>
            <StatusBadge status={item.status} />
          </View>
          <View style={styles.routeRow}>
            <Icon name="pickup" size={iconSize.xs} color={colors.textMuted} />
            <Text style={styles.route} numberOfLines={1}>{item.pickupLocation?.address}</Text>
            <Icon name="forward" size={iconSize.xs} color={colors.textMuted} />
            <Icon name="dropoff" size={iconSize.xs} color={colors.textMuted} />
            <Text style={styles.route} numberOfLines={1}>{item.dropoffLocation?.address}</Text>
          </View>
          <View style={styles.rowBottom}>
            <View style={styles.metaRow}>
              <Icon name="quote" size={iconSize.xs} color={colors.textMuted} />
              <Text style={styles.meta}>{item.totalQuotes || 0} quotes</Text>
            </View>
            {item.budgetEstimate ? <Text style={styles.budget}>{formatCurrency(item.budgetEstimate)}</Text> : null}
          </View>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, flexGrow: 1 },
  filters: { marginBottom: spacing.xs },
  searchInput: { marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { minWidth: 84 },
  card: { marginVertical: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, flexWrap: 'wrap' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goodsType: { ...type.h3, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  route: { ...type.small, color: colors.textMuted },
  meta: { ...type.small, color: colors.textMuted },
  budget: { ...type.bodyMedium, color: colors.primaryText },
  date: { ...type.small, fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
});

export default LoadsListScreen;
