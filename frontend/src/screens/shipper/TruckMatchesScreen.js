import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { formatCurrency, formatKg, getErrorMessage } from '../../utils/helpers';
import { dayLabel } from '../../utils/nepalDate';
import { notify } from '../../utils/alert';

const SORTS = [
  { value: 'best', label: 'Best Match' },
  { value: 'price', label: 'Lowest Price' },
  { value: 'distance', label: 'Nearest' },
  { value: 'rating', label: 'Top Rated' },
];

const lastIfMissing = (value) => (value == null ? Infinity : value);

// The server sends the best match first; the other orders are re-sorted here.
const sortMatches = (matches, sort) => {
  const sorted = [...matches];
  if (sort === 'price') sorted.sort((a, b) => lastIfMissing(a.askingPrice) - lastIfMissing(b.askingPrice));
  if (sort === 'distance') sorted.sort((a, b) => lastIfMissing(a.distanceToPickupKm) - lastIfMissing(b.distanceToPickupKm));
  if (sort === 'rating') sorted.sort((a, b) => b.owner.rating - a.owner.rating || b.owner.totalRatings - a.owner.totalRatings);
  return sorted;
};

const NOT_TAKING_OFFERS = {
  booked: 'It has been booked. Open the load to see the booking.',
  expired: 'It expired before a truck was booked. You can relist it from the load page.',
  cancelled: 'It was cancelled.',
};

const Meta = ({ icon, text }) => (
  <View style={styles.meta}>
    <Icon name={icon} size={iconSize.sm} color={colors.textMuted} />
    <Text style={styles.metaText}>{text}</Text>
  </View>
);

// Step two of booking a truck: the trucks that can carry the load, ranked, and
// a way to ask any of them at their asking price or at the shipper's own.
const TruckMatchesScreen = ({ route, navigation }) => {
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
      notify('Truck booked', 'The owner accepted your offer.', () => navigation.replace('BookingDetail', { bookingId: booking._id }));
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
      notify('Request sent', `${match.owner.name} can now accept, counter or decline your offer of ${formatCurrency(price)}.`);
      await fetchMatches();
    } catch (error) {
      notify('Could not send the request', getErrorMessage(error));
    }
    setSendingTruckId(null);
  };

  if (!data) {
    return loadError ? (
      <View style={styles.container}>
        <EmptyState icon="offline" tone="error" title="Could not load trucks" message={loadError} actionLabel="Try Again" onAction={fetchMatches} />
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
          {load.pickupDay ? <Meta icon="calendar" text={`Pickup ${dayLabel(load.pickupDay)}`} /> : null}
          {load.distanceKm ? <Meta icon="route" text={`About ${load.distanceKm} km by road`} /> : null}
          {takingOffers ? <Meta icon="send" text={`${openRequests} of ${maxOpenRequests} requests waiting`} /> : null}
        </View>

        <View style={[styles.summaryFooter, !layout.isPhone && styles.summaryFooterWide]}>
          <Text style={styles.summaryHint}>
            {takingOffers
              ? `Ask up to ${maxOpenRequests} trucks at once. The first owner to accept books the load, and your other requests close.`
              : 'This load is no longer taking offers.'}
          </Text>
          <Button title="View Load and Offers" icon="document" variant="tertiary" size="sm" onPress={openLoad} />
        </View>
      </Card>

      {!takingOffers ? (
        <EmptyState
          icon="load"
          title="This load isn't taking offers"
          message={NOT_TAKING_OFFERS[load.status] || 'Open the load to see where it stands.'}
          actionLabel="View Load"
          onAction={openLoad}
        />
      ) : matches.length === 0 ? (
        <EmptyState
          icon="truck"
          title="No trucks available yet"
          message={`No verified truck that carries ${formatKg(load.weight)} is free for ${dayLabel(load.pickupDay) || 'this date'}. Your load is live, so owners can still send you quotes.`}
          actionLabel="View Load"
          onAction={openLoad}
        />
      ) : (
        <>
          <View style={[styles.listHeader, !layout.isPhone && styles.listHeaderWide]}>
            <Text style={styles.listTitle}>
              {`${matches.length} ${matches.length === 1 ? 'truck can' : 'trucks can'} carry this load`}
            </Text>
            <View style={styles.sortRow} accessibilityRole="radiogroup">
              {SORTS.map((option) => (
                <Button
                  key={option.value}
                  title={option.label}
                  size="sm"
                  variant={sort === option.value ? 'primary' : 'tertiary'}
                  onPress={() => setSort(option.value)}
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
