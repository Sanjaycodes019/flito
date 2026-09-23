import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import DeliveryProofSection from '../components/bookings/DeliveryProofSection';
import DeliverySignatureSection from '../components/bookings/DeliverySignatureSection';
import LocationSharingToggle from '../components/bookings/LocationSharingToggle';
import CallContactsCard from '../components/bookings/CallContactsCard';
import DriverJobCard from '../components/bookings/DriverJobCard';
import TrackingMap from '../components/map/TrackingMap';
import VerifiedBadge from '../components/common/VerifiedBadge';
import useScreenLayout from '../hooks/useScreenLayout';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize, themedStyles } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, formatStatus, getErrorMessage, truckTypeLabel } from '../utils/helpers';
import api from '../services/api';
import socketService from '../services/socket';
import { confirmAction, notify } from '../utils/alert';

const DETAIL_ICON = {
  pickup: 'pickup',
  dropoff: 'dropoff',
  amount: 'price',
  shipper: 'shipper',
  owner: 'owner',
  driver: 'driver',
  truck: 'truck',
  pickupStatus: 'pickup',
  dropoffStatus: 'dropoff',
  booked: 'calendar',
};

const BookingDetailScreen = ({ route }) => {
  const { t } = useTranslation();
  const { bookingId } = route.params;
  const { user } = useSelector((state) => state.auth);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [driverPhone, setDriverPhone] = useState('');
  // The owner's own drivers (added from the Fleet page), to pick from.
  const [myDrivers, setMyDrivers] = useState([]);
  const [rating, setRating] = useState('5');
  const [review, setReview] = useState('');
  // One readable column below desktop; the booking and its actions side by side above.
  const layout = useScreenLayout('narrow', 'wide');
  const twoColumns = layout.isDesktop;

  const isOwner = user?.role === ROLES.OWNER && String(booking?.ownerId?._id || booking?.ownerId) === user?._id;
  const isDriver = user?.role === ROLES.DRIVER && String(booking?.driverId?._id || booking?.driverId) === user?._id;
  const isShipper = user?.role === ROLES.SHIPPER && String(booking?.shipperId?._id || booking?.shipperId) === user?._id;

  const fetchBooking = useCallback(async () => {
    try {
      const { data } = await api.get(`/bookings/${bookingId}`);
      setBooking(data.booking);
    } catch (error) {
      notify(t('bookings:detail.errorTitle'), getErrorMessage(error));
    }
  }, [bookingId, t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchBooking();
      setLoading(false);
    })();
  }, [fetchBooking]);

  const needsDriver = isOwner && !booking?.driverId && booking?.status !== 'cancelled';
  useEffect(() => {
    if (!needsDriver) return;
    api.get('/users/me/drivers')
      .then(({ data }) => setMyDrivers(data.drivers || []))
      .catch(() => setMyDrivers([]));
  }, [needsDriver]);

  // The driver's marker moves from socket pings without a full refetch; a
  // refresh (pull-to-refresh, or fetchBooking after an action) still carries
  // the persisted currentLocation, so this is a live overlay, not the source
  // of truth.
  useEffect(() => {
    const onLocationUpdate = ({ bookingId: id, lat, lng }) => {
      if (id !== bookingId) return;
      setBooking((current) => (current ? { ...current, currentLocation: { lat, lng } } : current));
    };
    socketService.on('location-update', onLocationUpdate);
    return () => socketService.off('location-update', onLocationUpdate);
  }, [bookingId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBooking();
    setRefreshing(false);
  };

  const runAction = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await fetchBooking();
    } catch (error) {
      notify(t('bookings:detail.errorTitle'), getErrorMessage(error));
    }
    setBusy(false);
  };

  const assignMyDriver = (driver) => confirmAction({
    title: t('bookings:assign.confirmTitle', { name: driver.firstName }),
    message: t('bookings:assign.confirmMessage'),
    confirmLabel: t('bookings:assign.confirmLabel'),
    onConfirm: () => runAction(async () => {
      await api.patch(`/bookings/${bookingId}/assign-driver`, { driverId: driver._id });
      notify(t('bookings:detail.driverAssignedTitle'), t('bookings:detail.driverAssignedMessage', { name: driver.firstName }));
    }),
  });

  const handleAssignDriver = () => runAction(async () => {
    if (!driverPhone) {
      notify(t('bookings:detail.missingPhoneTitle'), t('bookings:detail.missingPhoneMessage'));
      return;
    }
    const { data: lookup } = await api.get('/users/lookup', { params: { phone: driverPhone } });
    // The server enforces this too; checking first gives a clearer message.
    if (lookup.driver.kycStatus !== 'approved') {
      notify(
        t('bookings:detail.driverNotVerifiedTitle'),
        t('bookings:detail.driverNotVerifiedMessage', { name: lookup.driver.firstName })
      );
      return;
    }
    await api.patch(`/bookings/${bookingId}/assign-driver`, { driverId: lookup.driver._id });
    notify(t('bookings:detail.driverAssignedTitle'), t('bookings:detail.driverAssignedMessage', { name: lookup.driver.firstName }));
  });

  // Steps that cannot be taken back ask first, so a stray tap does not
  // move the job on or cancel it.
  const confirmThen = (key, action, destructive = false) => confirmAction({
    title: t(`bookings:confirm.${key}Title`),
    message: t(`bookings:confirm.${key}Message`),
    confirmLabel: t(`bookings:confirm.${key}Confirm`),
    destructive,
    onConfirm: action,
  });

  // The driver's next step (see DriverJobCard), asking first when it can't be undone.
  const handleDriverStep = (step) => {
    const send = () => runAction(() => api.patch(`/bookings/${bookingId}/status`, step.send));
    if (step.confirm) confirmThen(step.confirm, send);
    else send();
  };

  const handleCancel = () => confirmThen(
    'cancel',
    () => runAction(() => api.patch(`/bookings/${bookingId}/status`, { status: 'cancelled' })),
    true
  );

  const handleRate = () => runAction(async () => {
    await api.post(`/bookings/${bookingId}/rate`, { rating: Number(rating), review });
    notify(t('bookings:detail.thanksTitle'), t('bookings:detail.ratingSubmittedMessage'));
  });

  if (loading) return <Spinner />;
  if (!booking) return <EmptyState icon="empty" title={t('bookings:detail.notFoundTitle')} message={t('bookings:detail.notFoundMessage')} />;

  const alreadyRated = isShipper ? !!booking.ownerRating?.rating : isOwner ? !!booking.shipperRating?.rating : true;

  // Mirrors the server rule: proof comes from the driver once cargo is picked up.
  const canAddProof = isDriver && (
    booking.status === 'completed'
    || (booking.status === 'in_transit' && booking.pickupStatus === 'picked_up')
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={layout.contentStyle}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={twoColumns ? styles.columns : null}>
        <View style={twoColumns ? styles.mainColumn : null}>
          {/* For the driver the next step is the whole point of this page, so it comes first. */}
          {isDriver && booking.status !== 'completed' && booking.status !== 'cancelled' && (
            <DriverJobCard booking={booking} busy={busy} onStep={handleDriverStep} />
          )}
          <CallContactsCard booking={booking} myId={user?._id} />
          <Card>
            <View style={styles.row}>
              <Text style={styles.title}>{booking.loadId?.goodsType || t('bookings:detail.loadFallback')}</Text>
              <StatusBadge status={booking.status} />
            </View>
            <Detail labelKey="pickup" label={t('bookings:detail.pickup')} value={booking.loadId?.pickupLocation?.address} />
            <Detail labelKey="dropoff" label={t('bookings:detail.dropoff')} value={booking.loadId?.dropoffLocation?.address} />
            <Detail labelKey="amount" label={t('bookings:detail.amount')} value={formatCurrency(booking.totalAmount)} />
            <Detail
              labelKey="shipper"
              label={t('bookings:detail.shipper')}
              value={`${booking.shipperId?.firstName || ''} ${booking.shipperId?.lastName || ''}`}
              verified={booking.shipperId?.verified}
            />
            <Detail
              labelKey="owner"
              label={t('bookings:detail.owner')}
              value={booking.ownerId?.companyName || `${booking.ownerId?.firstName || ''} ${booking.ownerId?.lastName || ''}`}
              verified={booking.ownerId?.verified}
            />
            {booking.truckId ? (
              <Detail
                labelKey="truck"
                label={t('bookings:detail.truck')}
                value={[truckTypeLabel(booking.truckId.truckType), booking.truckId.registrationNumber].filter(Boolean).join(' · ')}
                verified={booking.truckId.verified}
                verifiedLabel={t('bookings:detail.verifiedTruck')}
              />
            ) : null}
            <Detail
              labelKey="driver"
              label={t('bookings:detail.driver')}
              value={booking.driverId ? `${booking.driverId.firstName} ${booking.driverId.lastName}` : t('bookings:detail.notAssigned')}
              verified={booking.driverId?.verified}
            />
            <Detail labelKey="pickupStatus" label={t('bookings:detail.pickupStatusLabel')} value={formatStatus(booking.pickupStatus, t)} />
            <Detail labelKey="dropoffStatus" label={t('bookings:detail.dropoffStatusLabel')} value={formatStatus(booking.dropoffStatus, t)} />
            <Detail labelKey="booked" label={t('bookings:detail.booked')} value={formatDate(booking.createdAt)} />

            <TrackingMap
              pickup={booking.loadId?.pickupLocation?.coordinates?.lat != null ? booking.loadId.pickupLocation.coordinates : null}
              dropoff={booking.loadId?.dropoffLocation?.coordinates?.lat != null ? booking.loadId.dropoffLocation.coordinates : null}
              driverLocation={booking.currentLocation?.lat != null ? booking.currentLocation : null}
            />
          </Card>
        </View>

        <View style={twoColumns ? styles.sideColumn : null}>
          {isDriver && booking.status === 'in_transit' && (
            <LocationSharingToggle bookingId={bookingId} />
          )}

          {needsDriver && (
            <Card>
              <SectionTitle icon="driver" title={t('bookings:detail.assignDriverTitle')} />
              {myDrivers.map((driver) => (driver.kycStatus === 'approved' ? (
                <Button
                  key={driver._id}
                  title={`${driver.firstName} ${driver.lastName || ''}`.trim()}
                  icon="driver"
                  size="lg"
                  variant="tertiary"
                  onPress={() => assignMyDriver(driver)}
                  loading={busy}
                  accessibilityLabel={t('bookings:assign.pickAccessibilityLabel', { name: driver.firstName })}
                />
              ) : (
                <Text key={driver._id} style={styles.waitingDriver}>
                  {t('bookings:assign.notReady', { name: driver.firstName })}
                </Text>
              )))}
              {myDrivers.length > 0 && <Text style={styles.otherDriverLabel}>{t('bookings:assign.otherDriver')}</Text>}
              <Input
                value={driverPhone}
                onChangeText={setDriverPhone}
                placeholder={t('bookings:detail.phonePlaceholder')}
                keyboardType="phone-pad"
                icon="phone"
              />
              <Button title={t('bookings:detail.findAndAssign')} icon="search" onPress={handleAssignDriver} loading={busy} />
            </Card>
          )}

          <DeliveryProofSection booking={booking} canUpload={canAddProof} onChanged={fetchBooking} />
          <DeliverySignatureSection booking={booking} canUpload={canAddProof} onChanged={fetchBooking} />

          {isShipper && ['pending', 'confirmed'].includes(booking.status) && (
            <Button title={t('bookings:detail.cancelBooking')} icon="close" variant="destructive" onPress={handleCancel} loading={busy} style={styles.cancelButton} />
          )}

          {booking.status === 'completed' && !alreadyRated && (
            <Card>
              <SectionTitle
                icon="star"
                title={t('bookings:detail.rate', { party: isShipper ? t('bookings:detail.theOwner') : t('bookings:detail.theShipper') })}
              />
              <View style={styles.chipRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    title={String(n)}
                    variant={rating === String(n) ? 'primary' : 'tertiary'}
                    onPress={() => setRating(String(n))}
                    style={styles.ratingChip}
                  />
                ))}
              </View>
              <Input value={review} onChangeText={setReview} placeholder={t('bookings:detail.reviewPlaceholder')} icon="document" />
              <Button title={t('bookings:detail.submitRating')} icon="send" onPress={handleRate} loading={busy} />
            </Card>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const SectionTitle = ({ icon, title }) => (
  <View style={styles.sectionTitleRow}>
    <Icon name={icon} size={iconSize.md} color={colors.primaryText} style={styles.sectionIcon} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const Detail = ({ labelKey, label, value, verified = false, verifiedLabel }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabelRow}>
      {!!DETAIL_ICON[labelKey] && <Icon name={DETAIL_ICON[labelKey]} size={iconSize.xs} color={colors.textMuted} style={styles.detailIcon} />}
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <View style={styles.detailValueRow}>
      <Text style={styles.detailValue}>{value || '-'}</Text>
      {verified && <VerifiedBadge size={14} label={verifiedLabel} />}
    </View>
  </View>
);

const styles = themedStyles(() => ({
  container: { flex: 1, backgroundColor: colors.background },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  mainColumn: { flex: 3, minWidth: 0 },
  sideColumn: { flex: 2, minWidth: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...type.h2, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabelRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: spacing.xs },
  detailLabel: { ...type.small, color: colors.textMuted },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, flexShrink: 1 },
  detailValue: { ...type.smallMedium, color: colors.textPrimary, textTransform: 'capitalize', flexShrink: 1, textAlign: 'right' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sectionIcon: { marginRight: spacing.xs },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  cancelButton: { marginTop: spacing.xs },
  waitingDriver: { ...type.small, color: colors.textMuted, paddingVertical: spacing.sm },
  otherDriverLabel: { ...type.smallMedium, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  ratingChip: { flex: 1, marginVertical: 0 },
}));

export default BookingDetailScreen;
