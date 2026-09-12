import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { FLITO_COLORS } from '../../utils/colors';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import api from '../../services/api';

// Once a load leaves "open" it disappears from the browse list, so this is the
// owner's only route back to a negotiation they're part of — including ones
// where the shipper has countered and is waiting on them.
const MyQuotesScreen = ({ navigation }) => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/quotes/mine');
      setQuotes(data.quotes);
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={quotes}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        !loading && <Text style={styles.empty}>You haven't quoted on any loads yet</Text>
      }
      renderItem={({ item }) => {
        const load = item.loadId || {};
        const needsYou = item.status === 'countered' && item.counterOfferBy === 'shipper';

        return (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('LoadDetail', { loadId: load._id || load })}
          >
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.goodsType}>{load.goodsType || 'Load'}</Text>
                <StatusBadge status={item.status} />
              </View>
              {load.pickupLocation?.address ? (
                <Text style={styles.route}>
                  {load.pickupLocation.address} → {load.dropoffLocation?.address}
                </Text>
              ) : null}
              <View style={styles.rowBottom}>
                <Text style={styles.price}>{formatCurrency(item.counterOfferPrice ?? item.quotedPrice)}</Text>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              </View>
              {needsYou && <Text style={styles.actionNeeded}>The shipper countered — your response is needed</Text>}
            </Card>
          </TouchableOpacity>
        );
      }}
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
  price: { fontSize: 15, fontWeight: '700', color: FLITO_COLORS.primary },
  date: { fontSize: 11, color: FLITO_COLORS.textMuted },
  actionNeeded: { fontSize: 12, color: FLITO_COLORS.warning, fontWeight: '600', marginTop: 8 },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 40, fontSize: 14 },
});

export default MyQuotesScreen;
