import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import Card from '../../components/common/Card';
import Spinner from '../../components/common/Spinner';
import { FLITO_COLORS } from '../../utils/colors';
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Earnings</Text>
          <Text style={styles.summaryValue}>{formatCurrency(total)}</Text>
          <Text style={styles.summaryMeta}>{pluralize(bookings.length, 'completed job')}</Text>
        </Card>
      }
      ListEmptyComponent={<Text style={styles.empty}>No completed jobs yet</Text>}
      renderItem={({ item }) => (
        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.goodsType}>{item.loadId?.goodsType || 'Load'}</Text>
            <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
          </View>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
        </Card>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  summaryCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: FLITO_COLORS.textMuted },
  summaryValue: { fontSize: 32, fontWeight: '800', color: FLITO_COLORS.primary, marginVertical: 4 },
  summaryMeta: { fontSize: 12, color: FLITO_COLORS.textMuted },
  card: { marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goodsType: { fontSize: 15, fontWeight: '600', color: FLITO_COLORS.secondary },
  amount: { fontSize: 15, fontWeight: '700', color: FLITO_COLORS.primary },
  date: { fontSize: 12, color: FLITO_COLORS.textMuted, marginTop: 4 },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 40, fontSize: 14 },
});

export default EarningsScreen;
