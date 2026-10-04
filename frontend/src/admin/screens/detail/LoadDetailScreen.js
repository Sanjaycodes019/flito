import React, { useState } from 'react';
import { View, Text, Image, Pressable, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import TruckSlots from '../../../components/loads/TruckSlots';
import { colors, spacing, radius, type, themedStyles } from '../../../theme/tokens';
import { formatCurrency, formatKg, formatTrip, truckTypeLabel } from '../../../utils/helpers';
import { dayLabel } from '../../../utils/nepalDate';
import api from '../../../services/api';
import useAdminRecord from '../../useAdminRecord';
import { refreshAdminStats } from '../../useAdminStats';
import { formatPhone, formatWhen } from '../../format';
import DetailPage from '../../components/detail/DetailPage';
import { Hero, Lead, Panel, InfoGrid, InfoItem, Notice, Muted } from '../../components/detail/DetailParts';
import ReasonModal from '../../components/detail/ReasonModal';
import HistoryTimeline from '../../components/detail/HistoryTimeline';
import { BookingRow, PersonRow, TruckRow } from '../../components/detail/rows';

const CANCELLABLE = ['open', 'quoted', 'negotiating', 'expired'];

const Stop = ({ kind, stop }) => {
  const { t } = useTranslation();
  return (
    <InfoItem icon={kind} label={t(`loads:common.${kind}`)} wide>
      {stop ? (
        <View>
          <Text style={styles.address} selectable>{stop.address || stop.label}</Text>
          {stop.contactPerson || stop.phone ? (
            <Text style={styles.contact}>{[stop.contactPerson, formatPhone(stop.phone)].filter(Boolean).join(' · ')}</Text>
          ) : null}
        </View>
      ) : null}
    </InfoItem>
  );
};

// One load: the cargo and its route, how many trucks it needs and has, its
// shipper, every offer made on it and the bookings it became, and a way for
// FLITO to take it off the market.
const LoadDetailScreen = ({ route }) => {
  const { t } = useTranslation();
  const { loadId } = route.params;
  const record = useAdminRecord(`/admin/loads/${loadId}`);
  const [cancelling, setCancelling] = useState(false);
  const { load, history = [] } = record.data || {};

  if (!load) return <DetailPage kind="load" record={record} />;

  const cancellable = CANCELLABLE.includes(load.status) && load.trucksBooked === 0;
  const routeText = [load.pickup?.label, load.dropoff?.label].filter(Boolean).join(' → ');

  const cancel = async (reason) => {
    const { data } = await api.post(`/admin/loads/${loadId}/cancel`, { reason });
    record.replace({ load: data.load, history: data.history });
    refreshAdminStats();
  };

  return (
    <DetailPage
      kind="load"
      record={record}
      title={load.goodsType}
      hero={(
        <Hero
          lead={<Lead icon="load" size={72} />}
          kicker={t('admin:detail.load.kicker', { date: formatWhen(load.createdAt) })}
          title={load.goodsType}
          subtitle={routeText || null}
          badges={<StatusBadge status={load.status} />}
          stats={[
            { icon: 'weight', value: load.weight ? formatKg(load.weight) : '—', label: t('admin:detail.load.weight') },
            { icon: 'truck', value: `${load.trucksBooked}/${load.trucksNeeded}`, label: t('admin:detail.load.trucksBooked') },
            { icon: 'quote', value: load.totalQuotes, label: t('admin:detail.stats.offers', { count: load.totalQuotes }) },
            ...(load.distanceKm ? [{ icon: 'route', value: `${load.distanceKm} km`, label: t('admin:detail.booking.distance') }] : []),
          ]}
        />
      )}
      side={(
        <>
          <Panel icon="admin" title={t('admin:detail.booking.adminActions')}>
            {cancellable ? (
              <>
                <Muted>{t('admin:detail.load.cancelHint')}</Muted>
                <Button
                  title={t('admin:detail.load.cancelButton')}
                  icon="close"
                  variant="destructive"
                  onPress={() => setCancelling(true)}
                  style={styles.sideButton}
                />
              </>
            ) : (
              <Muted>{load.trucksBooked > 0 ? t('admin:detail.load.hasBookings') : t(`admin:detail.load.closed.${load.status}`, t('admin:detail.load.closed.default'))}</Muted>
            )}
            <ReasonModal
              visible={cancelling}
              title={t('admin:detail.load.cancelTitle')}
              message={t('admin:detail.load.cancelMessage')}
              confirmLabel={t('admin:detail.load.cancelConfirm')}
              destructive
              onConfirm={cancel}
              onClose={() => setCancelling(false)}
            />
          </Panel>

          <Panel icon="shipper" title={t('admin:detail.load.shipper')}>
            {load.shipper ? <PersonRow first person={load.shipper} role={t('admin:roles.shipper')} /> : <Muted>{t('admin:loadsList.shipperFallback')}</Muted>}
          </Panel>

          <HistoryTimeline entries={history} />
        </>
      )}
    >
      {load.status === 'cancelled' ? (
        <Notice tone="error" title={t('admin:detail.load.cancelledTitle')} />
      ) : null}

      <Panel icon="load" title={t('admin:detail.load.cargo')}>
        {load.trucksNeeded > 1 ? <TruckSlots load={load} style={styles.slots} /> : null}
        {load.description ? <Text style={styles.description} selectable>{load.description}</Text> : null}
        <InfoGrid>
          <Stop kind="pickup" stop={load.pickup} />
          <Stop kind="dropoff" stop={load.dropoff} />
          <InfoItem icon="calendar" label={t('admin:detail.booking.pickupDay')} value={load.pickupDay ? dayLabel(load.pickupDay) : null} />
          <InfoItem icon="route" label={t('admin:detail.booking.distance')} value={formatTrip(t, load)} />
          <InfoItem icon="weight" label={t('admin:detail.load.weight')} value={load.weight ? formatKg(load.weight) : null} />
          <InfoItem
            icon="truck"
            label={t('admin:detail.load.perTruck')}
            value={load.trucksNeeded > 1 && load.weightPerTruck ? t('loads:loadDetail.trucksValue', { trucks: t('loads:truckSlots.count', { count: load.trucksNeeded }), weight: formatKg(load.weightPerTruck) }) : t('loads:truckSlots.count', { count: 1 })}
          />
          <InfoItem label={t('admin:detail.load.truckType')} value={load.truckTypePreference && load.truckTypePreference !== 'any' ? truckTypeLabel(load.truckTypePreference, t) : t('admin:detail.load.anyTruck')} />
          <InfoItem label={t('admin:detail.load.budget')} value={load.budgetEstimate ? formatCurrency(load.budgetEstimate) : null} />
          <InfoItem label={t('admin:detail.load.openUntil')} value={load.expiresAt ? formatWhen(load.expiresAt) : null} />
          <InfoItem label={t('admin:detail.truck.updated')} value={formatWhen(load.updatedAt)} />
        </InfoGrid>
      </Panel>

      {load.photos.length ? (
        <Panel icon="image" title={t('admin:detail.load.photos')} count={load.photos.length}>
          <View style={styles.photos}>
            {load.photos.map((photo) => (
              <Pressable key={photo._id} onPress={() => Linking.openURL(photo.url)} accessibilityRole="link" accessibilityLabel={t('admin:detail.booking.openPhoto')}>
                <Image source={{ uri: photo.url }} style={styles.photo} />
              </Pressable>
            ))}
          </View>
        </Panel>
      ) : null}

      <Panel icon="truckDelivery" title={t('admin:detail.related.bookings')} count={load.bookings.length}>
        {load.bookings.length ? load.bookings.map((booking, index) => (
          <BookingRow key={booking._id} first={index === 0} booking={{ ...booking, load }} />
        )) : <Muted>{t('admin:detail.related.noBookings')}</Muted>}
      </Panel>

      <Panel icon="quote" title={t('admin:detail.load.offers')} count={load.offers.length}>
        {load.offers.length ? load.offers.map((offer, index) => (
          <View key={offer._id} style={[styles.offer, index > 0 && styles.offerRule]}>
            <View style={styles.offerHead}>
              <Text style={styles.offerPrice}>{formatCurrency(offer.price)}</Text>
              <Text style={styles.offerMeta}>
                {[t(`admin:detail.booking.openedBy.${offer.openedBy}`), formatWhen(offer.createdAt)].join(' · ')}
              </Text>
              <StatusBadge status={offer.status} />
            </View>
            {offer.owner ? <PersonRow first person={offer.owner} role={t('admin:roles.owner')} /> : null}
            {offer.truck ? <TruckRow first truck={offer.truck} /> : null}
          </View>
        )) : <Muted>{t('admin:detail.load.noOffers')}</Muted>}
      </Panel>
    </DetailPage>
  );
};

const styles = themedStyles(() => ({
  sideButton: { marginTop: spacing.md },
  slots: { marginTop: 0, marginBottom: spacing.md },
  description: { ...type.body, color: colors.textSecondary, marginBottom: spacing.sm },
  address: { ...type.bodyMedium, color: colors.textPrimary },
  contact: { ...type.small, color: colors.textSecondary, marginTop: 1 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  photo: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  offer: { paddingVertical: spacing.md },
  offerRule: { borderTopWidth: 1, borderTopColor: colors.divider },
  offerHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  offerPrice: { ...type.h3, color: colors.primaryText },
  offerMeta: { ...type.small, color: colors.textMuted, flex: 1, minWidth: 140 },
}));

export default LoadDetailScreen;
