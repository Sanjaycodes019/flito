import React, { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import RecordCard, { Fact, Pill, RouteLine } from '../../components/common/RecordCard';
import { CardCell, cardGridProps, useCardColumns } from '../../components/common/CardGrid';
import StatusBadge from '../../components/common/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { colors, themedStyles } from '../../theme/tokens';
import { formatCurrency, formatDate, getErrorMessage, truckTypeLabel } from '../../utils/helpers';
import { dayLabel } from '../../utils/nepalDate';
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
  const layout = useScreenLayout('wide');
  const columns = useCardColumns();

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
      key={`columns-${columns}`}
      {...cardGridProps(columns)}
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
          <CardCell columns={columns}>
            <RecordCard
              icon={request ? 'send' : 'quote'}
              title={goodsType}
              subtitle={request ? t('trucks:myQuotes.bookingRequestFromShipper') : t('trucks:myQuotes.yourQuote')}
              highlight={needsYou}
              badges={(
                <>
                  <StatusBadge status={item.status} />
                  <Pill icon="price" tone="accent">{formatCurrency(standingOffer(item).price)}</Pill>
                  {needsYou ? <Pill icon="warning" tone="warning">{t('common:card.yourTurn')}</Pill> : null}
                </>
              )}
              onPress={() => navigation.navigate('LoadDetail', { loadId: load._id || load })}
              accessibilityLabel={t('trucks:myQuotes.cardAccessibilityLabel', {
                goodsType,
                kind: request ? t('trucks:myQuotes.bookingRequestWord') : t('trucks:myQuotes.quoteWord'),
              })}
            >
              {load.pickupLocation || load.dropoffLocation ? (
                <RouteLine
                  from={load.pickupLocation?.label || load.pickupLocation?.address}
                  to={load.dropoffLocation?.label || load.dropoffLocation?.address}
                />
              ) : null}
              <Fact icon="truck" label={t('common:card.truck')}>
                {truck ? [truckTypeLabel(truck.truckType, t), truck.registrationNumber].filter(Boolean).join(' · ') : null}
              </Fact>
              <Fact icon="calendar" label={t('common:card.pickup')}>{load.pickupDay ? dayLabel(load.pickupDay) : null}</Fact>
              <Fact icon="time" label={t('common:card.sent')}>{formatDate(item.createdAt)}</Fact>
              {needsYou ? (
                <Fact icon="warning" tone="warning" lines={2}>
                  {request && item.status === 'pending' ? t('trucks:myQuotes.shipperWantsYourTruck') : t('trucks:myQuotes.shipperCountered')}
                </Fact>
              ) : null}
            </RecordCard>
          </CardCell>
        );
      }}
    />
  );
};

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
}));

export default MyQuotesScreen;
