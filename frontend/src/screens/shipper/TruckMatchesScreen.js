import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Grid from '../../components/common/Grid';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import TruckMatchCard from '../../components/loads/TruckMatchCard';
import OfferPriceModal from '../../components/loads/OfferPriceModal';
import Icon from '../../theme/icons';
import { colors, spacing, type, iconSize } from '../../theme/tokens';
import useScreenLayout from '../../hooks/useScreenLayout';
import api from '../../services/api';
import socketService from '../../services/socket';
import { formatCurrency, formatKg, formatTrip, getErrorMessage } from '../../utils/helpers';
import { dayLabel } from '../../utils/nepalDate';
import { notify } from '../../utils/alert';

const SORT_VALUES = ['best', 'price', 'distance', 'rating'];

const lastIfMissing = (value) => (value == null ? Infinity : value);

// The server sends the best match first; the other orders are re-sorted here.
const sortMatches = (matches, sort) => {
  const sorted = [...matches];
  if (sort === 'price') sorted.sort((a, b) => lastIfMissing(a.askingPrice) - lastIfMissing(b.askingPrice));
  if (sort === 'distance') sorted.sort((a, b) => lastIfMissing(a.distanceToPickupKm) - lastIfMissing(b.distanceToPickupKm));
  if (sort === 'rating') sorted.sort((a, b) => b.owner.rating - a.owner.rating || b.owner.totalRatings - a.owner.totalRatings);
  return sorted;
};

const notTakingOffersMessage = (status, t) => ({
  booked: t('loads:truckMatches.notTakingOffers.booked'),
  expired: t('loads:truckMatches.notTakingOffers.expired'),
  cancelled: t('loads:truckMatches.notTakingOffers.cancelled'),
}[status] || t('loads:truckMatches.notTakingOffers.default'));

const Meta = ({ icon, text }) => (
  <View style={styles.meta}>
    <Icon name={icon} size={iconSize.sm} color={colors.textMuted} />
    <Text style={styles.metaText}>{text}</Text>
  </View>
);

// Step two of booking a truck: the trucks that can carry the load, ranked, and
// a way to ask any of them at their asking price or at the shipper's own.
const TruckMatchesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { loadId } = route.params;
  const layout = useScreenLayout('narrow', 'wide');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState('best');
  const [offerFor, setOfferFor] = useState(null);
  const [sendingTruckId, setSendingTruckId] = useState(null);

  const fetchMatches = useCallback(async () => {
    try {
      const { data: response } = await api.get(`/loads/${loadId}/matches`);
      setData(response);
      setLoadError(null);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }, [loadId]);

  useFocusEffect(useCallback(() => { fetchMatches(); }, [fetchMatches]));

  // An owner replying moves the list on without a manual refresh; an owner
  // accepting books the load, so the shipper goes straight to the booking.
  useEffect(() => {
    const onChanged = () => fetchMatches();
    const onAccepted = ({ quote, booking }) => {
      if (String(quote?.loadId?._id || quote?.loadId) !== String(loadId)) return;
      notify(t('loads:truckMatches.truckBookedTitle'), t('loads:truckMatches.truckBookedMessage'), () => navigation.replace('BookingDetail', { bookingId: booking._id }));
    };
    socketService.on('new-quote', onChanged);
    socketService.on('quote-updated', onChanged);
    socketService.on('quote-accepted', onAccepted);
    return () => {
      socketService.off('new-quote', onChanged);
      socketService.off('quote-updated', onChanged);
      socketService.off('quote-accepted', onAccepted);
    };
  }, [loadId, fetchMatches, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  };

  const sendRequest = async (match, price) => {
    setSendingTruckId(match.truck._id);
    try {
      await api.post(`/loads/${loadId}/requests`, { truckId: match.truck._id, price });
      setOfferFor(null);
      notify(t('loads:truckMatches.requestSentTitle'), t('loads:truckMatches.requestSentMessage', { owner: match.owner.name, price: formatCurrency(price) }));
      await fetchMatches();
    } catch (error) {
      notify(t('loads:truckMatches.couldNotSendRequestTitle'), getErrorMessage(error));
    }
    setSendingTruckId(null);
  };

  if (!data) {
    return loadError ? (
      <View style={styles.container}>
        <EmptyState icon="offline" tone="error" title={t('loads:truckMatches.couldNotLoadTrucksTitle')} message={loadError} actionLabel={t('loads:common.tryAgain')} onAction={fetchMatches} />
      </View>
    ) : <Spinner />;
  }

  const { load, matches, takingOffers, openRequests, maxOpenRequests } = data;
  const sorted = sortMatches(matches, sort);
  const openLoad = () => navigation.navigate('LoadDetail', { loadId });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Card style={!layout.isPhone && styles.summaryWide}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryHeading}>
            <Text style={styles.summaryTitle} numberOfLines={1}>{load.goodsType}</Text>
            {load.weight ? <Text style={styles.summaryWeight}>{formatKg(load.weight)}</Text> : null}
          </View>
          <StatusBadge status={load.status} />
        </View>

        <View style={styles.routeRow}>
          <Icon name="pickup" size={iconSize.sm} color={colors.accentText} />
          <Text style={styles.route} numberOfLines={1}>{load.pickupLocation?.label || load.pickupLocation?.address}</Text>
          <Icon name="forward" size={iconSize.sm} color={colors.textMuted} />
          <Icon name="dropoff" size={iconSize.sm} color={colors.primaryText} />
          <Text style={styles.route} numberOfLines={1}>{load.dropoffLocation?.label || load.dropoffLocation?.address}</Text>
        </View>

        <View style={styles.metaRow}>
          {load.pickupDay ? <Meta icon="calendar" text={t('loads:truckMatches.pickupOn', { day: dayLabel(load.pickupDay) })} /> : null}
          {load.distanceKm ? <Meta icon="route" text={formatTrip(t, load)} /> : null}
          {takingOffers ? <Meta icon="send" text={t('loads:truckMatches.requestsWaiting', { open: openRequests, max: maxOpenRequests })} /> : null}
        </View>

        <View style={[styles.summaryFooter, !layout.isPhone && styles.summaryFooterWide]}>
          <Text style={styles.summaryHint}>
            {takingOffers
              ? t('loads:truckMatches.askUpToTrucksHint', { max: maxOpenRequests })
              : t('loads:truckMatches.noLongerTakingOffers')}
          </Text>
          <Button title={t('loads:truckMatches.viewLoadAndOffersButton')} icon="document" variant="tertiary" size="sm" onPress={openLoad} />
        </View>
      </Card>

      {!takingOffers ? (
        <EmptyState
          icon="load"
          title={t('loads:truckMatches.notTakingOffersTitle')}
          message={notTakingOffersMessage(load.status, t)}
          actionLabel={t('loads:truckMatches.viewLoadButton')}
          onAction={openLoad}
        />
      ) : matches.length === 0 ? (
        <EmptyState
          icon="truck"
          title={t('loads:truckMatches.noTrucksAvailableTitle')}
          message={t('loads:truckMatches.noTrucksAvailableMessage', { weight: formatKg(load.weight), day: dayLabel(load.pickupDay) || t('loads:truckMatches.thisDate') })}
          actionLabel={t('loads:truckMatches.viewLoadButton')}
          onAction={openLoad}
        />
      ) : (
        <>
          <View style={[styles.listHeader, !layout.isPhone && styles.listHeaderWide]}>
            <Text style={styles.listTitle}>
              {t('loads:truckMatches.listTitle', { count: matches.length })}
            </Text>
            <View style={styles.sortRow} accessibilityRole="radiogroup">
              {SORT_VALUES.map((value) => (
                <Button
                  key={value}
                  title={t(`loads:truckMatches.sorts.${value}`)}
                  size="sm"
                  variant={sort === value ? 'primary' : 'tertiary'}
                  onPress={() => setSort(value)}
                />
              ))}
            </View>
          </View>

          <Grid columns={layout.isDesktop ? 2 : 1}>
            {sorted.map((match, index) => (
              <TruckMatchCard
                key={String(match.truck._id)}
                match={match}
                best={sort === 'best' && index === 0}
                canRequest={openRequests < maxOpenRequests}
                maxOpenRequests={maxOpenRequests}
                sending={sendingTruckId === match.truck._id}
                onRequest={() => sendRequest(match, match.askingPrice)}
                onMakeOffer={() => setOfferFor(match)}
                onViewOffer={openLoad}
              />
            ))}
          </Grid>
        </>
      )}

      <OfferPriceModal
        visible={Boolean(offerFor)}
        match={offerFor}
        sending={Boolean(offerFor) && sendingTruckId === offerFor?.truck._id}
        onClose={() => setOfferFor(null)}
        onSend={(price) => sendRequest(offerFor, price)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  summaryWide: { padding: spacing.xxl },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryHeading: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flex: 1, minWidth: 0 },
  summaryTitle: { ...type.h2, color: colors.textPrimary, flexShrink: 1 },
  summaryWeight: { ...type.bodyMedium, color: colors.textMuted },
  routeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  route: { ...type.body, color: colors.textSecondary, flexShrink: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...type.small, color: colors.textMuted },
  summaryFooter: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, gap: spacing.xs },
  summaryFooterWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg },
  summaryHint: { ...type.small, color: colors.textSecondary, flex: 1 },

  listHeader: { marginTop: spacing.xl, marginBottom: spacing.md, gap: spacing.sm },
  listHeaderWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  listTitle: { ...type.h3, color: colors.textPrimary },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

export default TruckMatchesScreen;
