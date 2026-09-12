import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import { FLITO_COLORS } from '../utils/colors';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { fetchBookingsStart, fetchBookingsSuccess, fetchBookingsError } from '../redux/slices/bookingSlice';

const BookingsListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { items: bookings, isLoading } = useSelector((state) => state.bookings);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={bookings}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={!isLoading && <Text style={styles.empty}>No bookings yet</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('BookingDetail', { bookingId: item._id })}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.goodsType}>{item.loadId?.goodsType || 'Load'}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.route}>
              {item.loadId?.pickupLocation?.address} → {item.loadId?.dropoffLocation?.address}
            </Text>
            <View style={styles.rowBottom}>
              <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  card: { marginVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  goodsType: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary },
  route: { fontSize: 13, color: FLITO_COLORS.textMuted, marginTop: 6 },
  amount: { fontSize: 14, fontWeight: '700', color: FLITO_COLORS.primary },
  date: { fontSize: 11, color: FLITO_COLORS.textMuted },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 40, fontSize: 14 },
});

export default BookingsListScreen;
