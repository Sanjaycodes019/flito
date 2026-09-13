import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage, pluralize } from '../../utils/helpers';
import api from '../../services/api';
import { notify } from '../../utils/alert';

const EarningsScreen = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings');
      setBookings(data.bookings.filter((b) => b.status === 'completed'));
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <Spinner />;

  const total = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={bookings}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={
        <Card style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <Icon name="earnings" size={iconSize.lg} color={colors.primary} />
          </View>
          <Text style={styles.summaryLabel}>Total Earnings</Text>
          <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
          <Text style={styles.summaryMeta}>{pluralize(bookings.length, 'completed job')}</Text>
        </Card>
      }
      ListEmptyComponent={
        <EmptyState icon="earnings" title="No completed jobs yet" message="Your finished deliveries will appear here." />
      }
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.goodsType} numberOfLines={1}>{item.loadId?.goodsType || 'Load'}</Text>
            <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
          </View>
          <View style={styles.dateRow}>
            <Icon name="calendar" size={iconSize.xs} color={colors.textMuted} />
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, flexGrow: 1 },
  summaryCard: { alignItems: 'center', paddingVertical: spacing.xxl, marginBottom: spacing.sm },
  summaryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  summaryLabel: { ...type.small, color: colors.textMuted },
  summaryValue: { ...type.display, fontSize: 32, color: colors.primary, marginVertical: spacing.xs },
  summaryMeta: { ...type.small, color: colors.textMuted },
  card: { marginVertical: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goodsType: { ...type.bodyMedium, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  amount: { ...type.bodyMedium, color: colors.primary },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  date: { ...type.small, color: colors.textMuted },
});

export default EarningsScreen;
