import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Card from '../components/common/Card';
import StatusBadge from '../components/common/StatusBadge';
import { FLITO_COLORS } from '../utils/colors';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { fetchLoadsStart, fetchLoadsSuccess, fetchLoadsError } from '../redux/slices/loadsSlice';

const LoadsListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { items: loads, isLoading } = useSelector((state) => state.loads);
  const [refreshing, setRefreshing] = useState(false);

  const isShipper = user?.role === ROLES.SHIPPER;

  const load = useCallback(async () => {
    dispatch(fetchLoadsStart());
    try {
      const query = isShipper ? '?mine=true' : '?status=open';
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

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={loads}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        !isLoading && (
          <Text style={styles.empty}>{isShipper ? "You haven't posted any loads yet" : 'No open loads right now'}</Text>
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('LoadDetail', { loadId: item._id })}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.goodsType}>{item.goodsType}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.route}>{item.pickupLocation?.address} → {item.dropoffLocation?.address}</Text>
            <View style={styles.rowBottom}>
              <Text style={styles.meta}>{item.totalQuotes || 0} quotes</Text>
              {item.budgetEstimate ? <Text style={styles.budget}>{formatCurrency(item.budgetEstimate)}</Text> : null}
            </View>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
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
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  goodsType: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary },
  route: { fontSize: 13, color: FLITO_COLORS.textMuted, marginTop: 6 },
  meta: { fontSize: 12, color: FLITO_COLORS.textMuted },
  budget: { fontSize: 13, fontWeight: '700', color: FLITO_COLORS.primary },
  date: { fontSize: 11, color: FLITO_COLORS.textMuted, marginTop: 6 },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 40, fontSize: 14 },
});

export default LoadsListScreen;
