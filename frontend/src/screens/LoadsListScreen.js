import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Icon from '../theme/icons';
import { colors, spacing, type, iconSize } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError } from '../redux/slices/loadsSlice';

const LoadsListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { items: loads, isLoading, error } = useSelector((state) => state.loads);
  const [refreshing, setRefreshing] = useState(false);

  const isShipper = user?.role === ROLES.SHIPPER;

  const load = useCallback(async () => {
    dispatch(fetchLoadsStart());
    try {
      // Owners get the server's default browse: every load still taking bids.
      const query = isShipper ? '?mine=true' : '';
      const { data } = await api.get(`/loads${query}`);
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
      data={loads}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState
          icon="load"
          title={isShipper ? 'No loads yet' : 'No open loads right now'}
          message={isShipper ? "You haven't posted any loads yet. Post one to start getting quotes." : 'Check back soon, or widen your search.'}
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
