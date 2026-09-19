import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import Icon from '../../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage, truckTypeLabel } from '../../utils/helpers';
import { isTurnOf, openingSide, standingOffer } from '../../utils/negotiation';
import { notify } from '../../utils/alert';
import api from '../../services/api';
import useScreenLayout from '../../hooks/useScreenLayout';

// Every negotiation an owner is part of: quotes they sent, and booking
// requests shippers sent to their trucks. Once a load leaves "open" it
// disappears from browse, so this is the owner's way back to each of them.
const MyQuotesScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const layout = useScreenLayout('narrow');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/quotes/mine');
      setQuotes(data.quotes);
    } catch (error) {
      notify(t('trucks:myQuotes.errorTitle'), getErrorMessage(error));
    }
    setLoading(false);
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && !refreshing && quotes.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState icon="quote" title={t('trucks:myQuotes.loadingTitle')} message={t('trucks:myQuotes.loadingMessage')} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, layout.contentStyle]}
      data={quotes}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <EmptyState
          icon="quote"
          title={t('trucks:myQuotes.emptyTitle')}
          message={t('trucks:myQuotes.emptyMessage')}
        />
      }
      renderItem={({ item }) => {
        const load = item.loadId || {};
        const request = openingSide(item) === 'shipper';
        const needsYou = isTurnOf(item, 'owner');
        const truck = item.truckId && typeof item.truckId === 'object' ? item.truckId : null;
        const goodsType = load.goodsType || t('trucks:myQuotes.loadFallback');

        return (
          <Card
            style={styles.card}
            onPress={() => navigation.navigate('LoadDetail', { loadId: load._id || load })}
            accessibilityLabel={t('trucks:myQuotes.cardAccessibilityLabel', {
              goodsType,
              kind: request ? t('trucks:myQuotes.bookingRequestWord') : t('trucks:myQuotes.quoteWord'),
            })}
          >
            <View style={styles.row}>
              <Text style={styles.goodsType} numberOfLines={1}>{goodsType}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.kind} numberOfLines={1}>
              {[
                request ? t('trucks:myQuotes.bookingRequestFromShipper') : t('trucks:myQuotes.yourQuote'),
                truck && `${truckTypeLabel(truck.truckType, t)} ${truck.registrationNumber || ''}`.trim(),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {load.pickupLocation?.address ? (
              <View style={styles.routeRow}>
                <Icon name="pickup" size={iconSize.xs} color={colors.textMuted} />
                <Text style={styles.route} numberOfLines={1}>{load.pickupLocation.label || load.pickupLocation.address}</Text>
                <Icon name="forward" size={iconSize.xs} color={colors.textMuted} />
                <Icon name="dropoff" size={iconSize.xs} color={colors.textMuted} />
                <Text style={styles.route} numberOfLines={1}>{load.dropoffLocation?.label || load.dropoffLocation?.address}</Text>
              </View>
            ) : null}
            <View style={styles.rowBottom}>
              <Text style={styles.price}>{formatCurrency(standingOffer(item).price)}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            {needsYou && (
              <View style={styles.actionNeededRow}>
                <Icon name="warning" size={iconSize.xs} color={colors.warningText} />
                <Text style={styles.actionNeeded}>
                  {request && item.status === 'pending'
                    ? t('trucks:myQuotes.shipperWantsYourTruck')
                    : t('trucks:myQuotes.shipperCountered')}
                </Text>
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
  content: { flexGrow: 1 },
  card: { marginVertical: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { ...type.small, color: colors.textMuted, marginTop: spacing.xxs },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, flexWrap: 'wrap' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  goodsType: { ...type.h3, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  route: { ...type.small, color: colors.textMuted },
  price: { ...type.bodyMedium, color: colors.primaryText },
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
  actionNeeded: { ...type.small, color: colors.warningText, fontWeight: '600', flex: 1 },
});

export default MyQuotesScreen;
