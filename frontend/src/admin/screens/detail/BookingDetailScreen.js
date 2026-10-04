import React, { useState } from 'react';
import { View, Text, Image, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/common/Button';
import StatusBadge from '../../../components/common/StatusBadge';
import Icon from '../../../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../../../theme/tokens';
import { formatCurrency, formatKg, formatTrip } from '../../../utils/helpers';
import { dayLabel } from '../../../utils/nepalDate';
import api from '../../../services/api';
import useAdminRecord from '../../useAdminRecord';
import { refreshAdminStats } from '../../useAdminStats';
import { openAdminRecord } from '../../records';
import { formatPhone, formatWhen } from '../../format';
import DetailPage from '../../components/detail/DetailPage';
import { Hero, Lead, Panel, InfoGrid, InfoItem, Notice, Muted, RecordRow } from '../../components/detail/DetailParts';
import ReasonModal from '../../components/detail/ReasonModal';
import HistoryTimeline from '../../components/detail/HistoryTimeline';
import { PersonRow, TruckRow } from '../../components/detail/rows';

const CANCELLABLE = ['pending', 'confirmed', 'in_transit'];

// The trip as four steps, each done or not, from the booking's statuses.
const stepsOf = (booking) => {
  const delivered = booking.status === 'completed' || booking.dropoffStatus === 'delivered';
  const pickedUp = delivered || booking.status === 'in_transit' || booking.pickupStatus === 'picked_up';
  const confirmed = pickedUp || booking.status === 'confirmed';
  return [
    { key: 'booked', done: true },
    { key: 'confirmed', done: confirmed },
    { key: 'pickedUp', done: pickedUp },
    { key: 'delivered', done: delivered },
  ];
};

const Progress = ({ booking }) => {
  const { t } = useTranslation();
  const steps = stepsOf(booking);
  const current = steps.findIndex((step) => !step.done);
  return (
    <View style={styles.progress} accessibilityRole="progressbar">
      {steps.map((step, index) => (
        <View key={step.key} style={styles.step}>
          <View style={styles.stepTrack}>
            <View style={[styles.stepLine, index === 0 && styles.hidden, step.done && styles.stepLineDone]} />
            <View style={[styles.stepDot, step.done && styles.stepDotDone, index === current && styles.stepDotCurrent]}>
              {step.done ? <Icon name="checkmark" size={iconSize.xs} color={colors.textOnPrimary} /> : null}
            </View>
            <View style={[styles.stepLine, index === steps.length - 1 && styles.hidden, steps[index + 1]?.done && styles.stepLineDone]} />
          </View>
          <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]} numberOfLines={2}>{t(`admin:detail.booking.steps.${step.key}`)}</Text>
        </View>
      ))}
    </View>
  );
};

const Stop = ({ kind, stop }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.stop}>
      <View style={[styles.stopDot, kind === 'pickup' ? styles.stopDotPickup : styles.stopDotDropoff]} />
      <View style={styles.stopText}>
        <Text style={styles.stopLabel}>{t(`loads:common.${kind}`)}</Text>
        <Text style={styles.stopAddress} selectable>{stop?.address || stop?.label || t('admin:detail.notGiven')}</Text>
        {stop?.contactPerson || stop?.phone ? (
          <Text style={styles.stopContact}>{[stop.contactPerson, formatPhone(stop.phone)].filter(Boolean).join(' · ')}</Text>
        ) : null}
      </View>
    </View>
  );
};

const Rating = ({ label, rating }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.rating}>
      <Text style={styles.ratingLabel}>{label}</Text>
      {rating ? (
        <>
          <Text style={styles.stars} accessibilityLabel={t('admin:detail.booking.starsOutOf', { count: rating.rating })}>
            {'★'.repeat(rating.rating)}<Text style={styles.starsOff}>{'★'.repeat(5 - rating.rating)}</Text>
          </Text>
          {rating.review ? <Text style={styles.review} selectable>“{rating.review}”</Text> : null}
        </>
      ) : <Muted>{t('admin:detail.booking.notRated')}</Muted>}
    </View>
  );
};

// One booking: the trip and how far it has got, everyone on it, the agreed
// price and payments, proof of delivery, ratings, where the truck last was,
// and a way for FLITO to step in and cancel it.
const BookingDetailScreen = ({ route }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { bookingId } = route.params;
  const record = useAdminRecord(`/admin/bookings/${bookingId}`);
  const [cancelling, setCancelling] = useState(false);
  const { booking, history = [] } = record.data || {};

  if (!booking) return <DetailPage kind="booking" record={record} />;

  const load = booking.load;
  const payment = booking.payment;
  const title = load?.goodsType || t('admin:bookingsList.goodsFallback');
  const routeText = [load?.pickup?.label, load?.dropoff?.label].filter(Boolean).join(' → ');

  const cancel = async (reason) => {
    const { data } = await api.post(`/admin/bookings/${bookingId}/cancel`, { reason });
    record.replace({ booking: data.booking, history: data.history });
    refreshAdminStats();
  };

  return (
    <DetailPage
      kind="booking"
      record={record}
      title={title}
      hero={(
        <Hero
          lead={<Lead icon="truckDelivery" size={72} />}
          kicker={t('admin:detail.booking.kicker', { date: formatWhen(booking.createdAt) })}
          title={title}
          subtitle={routeText || null}
          badges={<StatusBadge status={booking.status} />}
          stats={[
            { icon: 'price', value: formatCurrency(payment.total), label: t('admin:detail.booking.agreedPrice') },
            { icon: 'wallet', value: formatCurrency(payment.paid), label: t('admin:detail.booking.paid') },
            { icon: 'time', value: formatCurrency(payment.pending), label: t('admin:detail.booking.due') },
            ...(load?.distanceKm ? [{ icon: 'route', value: `${load.distanceKm} km`, label: t('admin:detail.booking.distance') }] : []),
          ]}
        />
      )}
      side={(
        <>
          <Panel icon="admin" title={t('admin:detail.booking.adminActions')}>
            {CANCELLABLE.includes(booking.status) ? (
              <>
                <Muted>{t('admin:detail.booking.cancelHint')}</Muted>
                <Button
                  title={t('admin:detail.booking.cancelButton')}
                  icon="close"
                  variant="destructive"
                  onPress={() => setCancelling(true)}
                  style={styles.sideButton}
                />
              </>
            ) : (
              <Muted>{t(`admin:detail.booking.closed.${booking.status}`)}</Muted>
            )}
            <ReasonModal
              visible={cancelling}
              title={t('admin:detail.booking.cancelTitle')}
              message={t('admin:detail.booking.cancelMessage')}
              confirmLabel={t('admin:detail.booking.cancelConfirm')}
              destructive
              onConfirm={cancel}
              onClose={() => setCancelling(false)}
            />
          </Panel>

          <Panel icon="wallet" title={t('admin:detail.booking.payment')} action={<StatusBadge status={payment.status} />}>
            <InfoGrid>
              <InfoItem label={t('admin:detail.booking.agreedPrice')} value={formatCurrency(payment.total)} />
              <InfoItem label={t('admin:detail.booking.paid')} value={formatCurrency(payment.paid)} tone={payment.paid >= payment.total && payment.total ? 'success' : undefined} />
              <InfoItem label={t('admin:detail.booking.due')} value={formatCurrency(payment.pending)} tone={payment.pending > 0 ? 'warning' : undefined} />
              <InfoItem label={t('admin:detail.booking.method')} value={payment.method ? t(`admin:detail.booking.methods.${payment.method}`, payment.method) : null} />
            </InfoGrid>
            {payment.records.length ? payment.records.map((entry, index) => (
              <RecordRow
                key={entry._id}
                first={index === 0}
                lead={<Lead icon="wallet" size={32} tone="muted" />}
                title={formatCurrency(entry.amount)}
                subtitle={[t(`admin:detail.booking.methods.${entry.method}`, entry.method), entry.transactionId].filter(Boolean).join(' · ')}
                meta={formatWhen(entry.at)}
                right={<StatusBadge status={entry.status} />}
              />
            )) : null}
          </Panel>

          <Panel icon="people" title={t('admin:detail.booking.people')}>
            <PersonRow first person={booking.shipper} role={t('admin:roles.shipper')} />
            <PersonRow person={booking.owner} role={t('admin:roles.owner')} />
            {booking.driver
              ? <PersonRow person={booking.driver} role={t('admin:roles.driver')} />
              : <Notice tone="warning" title={t('admin:detail.booking.noDriver')}>{t('admin:detail.booking.noDriverHint')}</Notice>}
          </Panel>

          <HistoryTimeline entries={history} />
        </>
      )}
    >
      {booking.status === 'cancelled' ? (
        <Notice tone="error" title={t('admin:detail.booking.cancelledTitle')}>{t('admin:detail.booking.cancelledHint')}</Notice>
      ) : null}

      <Panel icon="route" title={t('admin:detail.booking.trip')}>
        <Progress booking={booking} />
        <View style={styles.stops}>
          <Stop kind="pickup" stop={load?.pickup} />
          <View style={styles.stopConnector} />
          <Stop kind="dropoff" stop={load?.dropoff} />
        </View>
        <InfoGrid>
          <InfoItem icon="calendar" label={t('admin:detail.booking.pickupDay')} value={load?.pickupDay ? dayLabel(load.pickupDay) : null} />
          <InfoItem icon="route" label={t('admin:detail.booking.distance')} value={load ? formatTrip(t, load) : null} />
          <InfoItem icon="weight" label={t('admin:detail.booking.weight')} value={load?.weight ? formatKg(load.weight) : null} />
          <InfoItem
            icon="truck"
            label={t('admin:detail.booking.trucksOnLoad')}
            value={load ? t('loads:truckSlots.booked', { booked: load.trucksBooked, needed: load.trucksNeeded }) : null}
          />
          <InfoItem label={t('admin:detail.booking.pickupStatus')} value={t(`common:status.${booking.pickupStatus}`, booking.pickupStatus)} />
          <InfoItem label={t('admin:detail.booking.dropoffStatus')} value={t(`common:status.${booking.dropoffStatus}`, booking.dropoffStatus)} />
        </InfoGrid>
        {load ? (
          <Button
            title={t('admin:detail.booking.openLoad')}
            icon="load"
            variant="tertiary"
            size="sm"
            onPress={() => openAdminRecord(navigation, 'load', load._id)}
            style={styles.inlineButton}
          />
        ) : null}
      </Panel>

      <Panel icon="truck" title={t('admin:detail.booking.truck')}>
        {booking.truck ? <TruckRow first truck={booking.truck} /> : <Muted>{t('admin:detail.booking.noTruck')}</Muted>}
        {booking.offer ? (
          <InfoGrid>
            <InfoItem
              label={t('admin:detail.booking.offeredBy')}
              value={t(`admin:detail.booking.openedBy.${booking.offer.openedBy}`)}
            />
            <InfoItem label={t('admin:detail.booking.offerPrice')} value={formatCurrency(booking.offer.price)} />
            <InfoItem
              label={t('admin:detail.booking.acceptedAt')}
              value={booking.offer.acceptedAt ? formatWhen(booking.offer.acceptedAt) : null}
            />
          </InfoGrid>
        ) : null}
      </Panel>

      <Panel icon="camera" title={t('admin:detail.booking.proof')} count={booking.deliveryPhotos.length + (booking.deliverySignature ? 1 : 0)}>
        {booking.deliveryPhotos.length || booking.deliverySignature ? (
          <View style={styles.proof}>
            {booking.deliveryPhotos.map((photo) => (
              <Pressable
                key={photo._id}
                onPress={() => Linking.openURL(photo.url)}
                accessibilityRole="link"
                accessibilityLabel={t('admin:detail.booking.openPhoto')}
                style={styles.proofTile}
              >
                <Image source={{ uri: photo.url }} style={styles.proofImage} />
                <Text style={styles.proofCaption}>{formatWhen(photo.uploadedAt)}</Text>
              </Pressable>
            ))}
            {booking.deliverySignature ? (
              <Pressable
                onPress={() => Linking.openURL(booking.deliverySignature.url)}
                accessibilityRole="link"
                accessibilityLabel={t('admin:detail.booking.signature')}
                style={styles.proofTile}
              >
                <Image source={{ uri: booking.deliverySignature.url }} style={[styles.proofImage, styles.signature]} resizeMode="contain" />
                <Text style={styles.proofCaption}>{t('admin:detail.booking.signature')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : <Muted>{t('admin:detail.booking.noProof')}</Muted>}
      </Panel>

      <Panel icon="star" title={t('admin:detail.booking.ratings')}>
        <View style={styles.ratings}>
          <Rating label={t('admin:detail.booking.byShipper')} rating={booking.ratings.byShipper} />
          <Rating label={t('admin:detail.booking.byOwner')} rating={booking.ratings.byOwner} />
        </View>
      </Panel>

      <Panel icon="location" title={t('admin:detail.booking.lastLocation')}>
        {booking.location ? (
          <>
            <InfoGrid>
              <InfoItem label={t('admin:detail.booking.coordinates')} value={`${booking.location.lat.toFixed(5)}, ${booking.location.lng.toFixed(5)}`} />
              <InfoItem label={t('admin:detail.booking.updated')} value={formatWhen(booking.location.updatedAt)} />
            </InfoGrid>
            <Button
              title={t('admin:detail.booking.openMap')}
              icon="navigate"
              variant="tertiary"
              size="sm"
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${booking.location.lat},${booking.location.lng}`)}
              style={styles.inlineButton}
            />
          </>
        ) : <Muted>{t('admin:detail.booking.noLocation')}</Muted>}
      </Panel>
    </DetailPage>
  );
};

const styles = themedStyles(() => ({
  sideButton: { marginTop: spacing.md },
  inlineButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
  hidden: { opacity: 0 },

  progress: { flexDirection: 'row', marginBottom: spacing.lg },
  step: { flex: 1, alignItems: 'center', minWidth: 0 },
  stepTrack: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  stepLine: { flex: 1, height: 3, backgroundColor: colors.divider },
  stepLineDone: { backgroundColor: colors.accentText },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: colors.accentText, borderColor: colors.accentText },
  stepDotCurrent: { borderColor: colors.primaryText },
  stepLabel: { ...type.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xxs },
  stepLabelDone: { color: colors.textPrimary, fontWeight: '600' },

  stops: { marginBottom: spacing.sm },
  stop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stopDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  stopDotPickup: { backgroundColor: colors.accent },
  stopDotDropoff: { backgroundColor: colors.primary },
  stopConnector: { width: 2, height: 16, marginLeft: 5, marginVertical: spacing.xxs, backgroundColor: colors.border },
  stopText: { flex: 1, minWidth: 0 },
  stopLabel: { ...type.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  stopAddress: { ...type.bodyMedium, color: colors.textPrimary },
  stopContact: { ...type.small, color: colors.textSecondary, marginTop: 1 },

  proof: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  proofTile: { width: 132, gap: spacing.xs },
  proofImage: { width: 132, height: 132, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  signature: { backgroundColor: colors.white },
  proofCaption: { ...type.small, color: colors.textMuted },

  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  rating: { flexGrow: 1, flexBasis: 220, gap: spacing.xxs },
  ratingLabel: { ...type.caption, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  stars: { fontSize: 20, color: colors.warningText, letterSpacing: 2 },
  starsOff: { color: colors.divider },
  review: { ...type.small, color: colors.textSecondary },
}));

export default BookingDetailScreen;
