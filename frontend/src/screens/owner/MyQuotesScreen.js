import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/helpers';
import { notify } from '../../utils/alert';
import api from '../../services/api';

// Once a load leaves "open" it disappears from the browse list, so this is the
// owner's only route back to a negotiation they're part of, including ones
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

  if (loading && !refreshing && quotes.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState icon="quote" title="Loading your quotes" message="One moment..." />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={quotes}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState icon="quote" title="No quotes yet" message="You haven't quoted on any loads yet. Browse open loads to submit one." />
      }
      renderItem={({ item }) => {
        const load = item.loadId || {};
        const needsYou = item.status === 'countered' && item.counterOfferBy === 'shipper';

        return (
          <Card
            style={styles.card}
            onPress={() => navigation.navigate('LoadDetail', { loadId: load._id || load })}
            accessibilityLabel={`${load.goodsType || 'Load'} quote`}
          >
            <View style={styles.row}>
              <Text style={styles.goodsType} numberOfLines={1}>{load.goodsType || 'Load'}</Text>
              <StatusBadge status={item.status} />
            </View>
            {load.pickupLocation?.address ? (
              <View style={styles.routeRow}>
                <Icon name="pickup" size={iconSize.xs} color={colors.textMuted} />
                <Text style={styles.route} numberOfLines={1}>{load.pickupLocation.address}</Text>
                <Icon name="forward" size={iconSize.xs} color={colors.textMuted} />
                <Icon name="dropoff" size={iconSize.xs} color={colors.textMuted} />
                <Text style={styles.route} numberOfLines={1}>{load.dropoffLocation?.address}</Text>
              </View>
            ) : null}
            <View style={styles.rowBottom}>
              <Text style={styles.price}>{formatCurrency(item.counterOfferPrice ?? item.quotedPrice)}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            {needsYou && (
              <View style={styles.actionNeededRow}>
                <Icon name="warning" size={iconSize.xs} color={colors.warning} />
                <Text style={styles.actionNeeded}>The shipper countered, your response is needed</Text>
              </View>
            )}
          </Card>
        );
      }}
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
  goodsType: { ...type.h3, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  route: { ...type.small, color: colors.textMuted },
  price: { ...type.bodyMedium, color: colors.primary },
  date: { ...type.small, color: colors.textMuted },
  actionNeededRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    backgroundColor: colors.warningMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionNeeded: { ...type.small, color: colors.warning, fontWeight: '600' },
});

export default MyQuotesScreen;
