import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import DeliveryProofSection from '../components/bookings/DeliveryProofSection';
import DeliverySignatureSection from '../components/bookings/DeliverySignatureSection';
import LocationSharingToggle from '../components/bookings/LocationSharingToggle';
import TrackingMap from '../components/map/TrackingMap';
import Icon from '../theme/icons';
import { colors, spacing, radius, type, iconSize } from '../theme/tokens';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, formatStatus, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import socketService from '../services/socket';
import { notify } from '../utils/alert';

const DETAIL_ICON = {
  Pickup: 'pickup',
  Dropoff: 'dropoff',
  Amount: 'price',
  Shipper: 'shipper',
  Owner: 'owner',
  Driver: 'driver',
  'Pickup Status': 'pickup',
  'Dropoff Status': 'dropoff',
  Booked: 'calendar',
};

const BookingDetailScreen = ({ route }) => {
  const { bookingId } = route.params;
  const { user } = useSelector((state) => state.auth);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [driverPhone, setDriverPhone] = useState('');
  const [rating, setRating] = useState('5');
  const [review, setReview] = useState('');

  const isOwner = user?.role === ROLES.OWNER && String(booking?.ownerId?._id || booking?.ownerId) === user?._id;
  const isDriver = user?.role === ROLES.DRIVER && String(booking?.driverId?._id || booking?.driverId) === user?._id;
  const isShipper = user?.role === ROLES.SHIPPER && String(booking?.shipperId?._id || booking?.shipperId) === user?._id;

  const fetchBooking = useCallback(async () => {
    try {
      const { data } = await api.get(`/bookings/${bookingId}`);
      setBooking(data.booking);
    } catch (error) {
      notify('Error', getErrorMessage(error));
    }
  }, [bookingId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchBooking();
      setLoading(false);
    })();
  }, [fetchBooking]);

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
      notify('Error', getErrorMessage(error));
    }
    setBusy(false);
  };

  const handleAssignDriver = () => runAction(async () => {
    if (!driverPhone) {
      notify('Missing phone', "Enter the driver's phone number");
      return;
    }
    const { data: lookup } = await api.get('/users/lookup', { params: { phone: driverPhone } });
    // The server enforces this too; checking first gives a clearer message.
    if (lookup.driver.kycStatus !== 'approved') {
      notify(
        'Driver not verified',
        `${lookup.driver.firstName} hasn't completed identity verification yet, so they can't be assigned to a booking.`
      );
      return;
    }
    await api.patch(`/bookings/${bookingId}/assign-driver`, { driverId: lookup.driver._id });
    notify('Driver assigned', `${lookup.driver.firstName} has been assigned to this booking`);
  });

  const handlePickupStatus = (pickupStatus) => runAction(() =>
    api.patch(`/bookings/${bookingId}/status`, { pickupStatus, status: pickupStatus === 'picked_up' ? 'in_transit' : undefined })
  );

  const handleDropoffStatus = (dropoffStatus) => runAction(() =>
    api.patch(`/bookings/${bookingId}/status`, { dropoffStatus, status: dropoffStatus === 'delivered' ? 'completed' : undefined })
  );

  const handleCancel = () => runAction(() => api.patch(`/bookings/${bookingId}/status`, { status: 'cancelled' }));

  const handleRate = () => runAction(async () => {
    await api.post(`/bookings/${bookingId}/rate`, { rating: Number(rating), review });
    notify('Thanks!', 'Your rating has been submitted');
  });

  if (loading) return <Spinner />;
  if (!booking) return <EmptyState icon="empty" title="Booking not found" message="This booking may have been removed." />;

  const alreadyRated = isShipper ? !!booking.ownerRating?.rating : isOwner ? !!booking.shipperRating?.rating : true;

  // Mirrors the server rule: proof comes from the driver once cargo is picked up.
  const canAddProof = isDriver && (
    booking.status === 'completed'
    || (booking.status === 'in_transit' && booking.pickupStatus === 'picked_up')
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Card>
        <View style={styles.row}>
          <Text style={styles.title}>{booking.loadId?.goodsType || 'Load'}</Text>
          <StatusBadge status={booking.status} />
        </View>
        <Detail label="Pickup" value={booking.loadId?.pickupLocation?.address} />
        <Detail label="Dropoff" value={booking.loadId?.dropoffLocation?.address} />
        <Detail label="Amount" value={formatCurrency(booking.totalAmount)} />
        <Detail label="Shipper" value={`${booking.shipperId?.firstName || ''} ${booking.shipperId?.lastName || ''}`} />
        <Detail label="Owner" value={booking.ownerId?.companyName || `${booking.ownerId?.firstName || ''} ${booking.ownerId?.lastName || ''}`} />
        <Detail label="Driver" value={booking.driverId ? `${booking.driverId.firstName} ${booking.driverId.lastName}` : 'Not assigned'} />
        <Detail label="Pickup Status" value={formatStatus(booking.pickupStatus)} />
        <Detail label="Dropoff Status" value={formatStatus(booking.dropoffStatus)} />
        <Detail label="Booked" value={formatDate(booking.createdAt)} />

        <TrackingMap
          pickup={booking.loadId?.pickupLocation?.coordinates?.lat != null ? booking.loadId.pickupLocation.coordinates : null}
          dropoff={booking.loadId?.dropoffLocation?.coordinates?.lat != null ? booking.loadId.dropoffLocation.coordinates : null}
          driverLocation={booking.currentLocation?.lat != null ? booking.currentLocation : null}
        />
      </Card>

      {isDriver && booking.status === 'in_transit' && (
        <LocationSharingToggle bookingId={bookingId} />
      )}

      {isOwner && !booking.driverId && booking.status !== 'cancelled' && (
        <Card>
          <SectionTitle icon="driver" title="Assign a Driver" />
          <Input
            value={driverPhone}
            onChangeText={setDriverPhone}
            placeholder="+9779841234567"
            keyboardType="phone-pad"
            icon="phone"
          />
          <Button title="Find & Assign" icon="search" onPress={handleAssignDriver} loading={busy} />
        </Card>
      )}

      {isDriver && booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <Card>
          <SectionTitle icon="truckDelivery" title="Update Job Status" />
          {booking.pickupStatus !== 'picked_up' && (
            <View style={styles.actionsRow}>
              <Button title="Arrived at Pickup" icon="pickup" variant="tertiary" onPress={() => handlePickupStatus('arrived')} loading={busy} style={styles.actionButton} />
              <Button title="Picked Up" icon="checkmark" onPress={() => handlePickupStatus('picked_up')} loading={busy} style={styles.actionButton} />
            </View>
          )}
          {booking.pickupStatus === 'picked_up' && booking.dropoffStatus !== 'delivered' && (
            <View style={styles.actionsRow}>
              <Button title="Arrived at Dropoff" icon="dropoff" variant="tertiary" onPress={() => handleDropoffStatus('arrived')} loading={busy} style={styles.actionButton} />
              <Button title="Delivered" icon="checkmark" onPress={() => handleDropoffStatus('delivered')} loading={busy} style={styles.actionButton} />
            </View>
          )}
        </Card>
      )}

      <DeliveryProofSection booking={booking} canUpload={canAddProof} onChanged={fetchBooking} />
      <DeliverySignatureSection booking={booking} canUpload={canAddProof} onChanged={fetchBooking} />

      {isShipper && ['pending', 'confirmed'].includes(booking.status) && (
        <Button title="Cancel Booking" icon="close" variant="destructive" onPress={handleCancel} loading={busy} style={styles.cancelButton} />
      )}

      {booking.status === 'completed' && !alreadyRated && (
        <Card>
          <SectionTitle icon="star" title={`Rate ${isShipper ? 'the Owner' : 'the Shipper'}`} />
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
          <Input value={review} onChangeText={setReview} placeholder="Optional review" icon="document" />
          <Button title="Submit Rating" icon="send" onPress={handleRate} loading={busy} />
        </Card>
      )}
    </ScrollView>
  );
};

const SectionTitle = ({ icon, title }) => (
  <View style={styles.sectionTitleRow}>
    <Icon name={icon} size={iconSize.md} color={colors.primary} style={styles.sectionIcon} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const Detail = ({ label, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabelRow}>
      {!!DETAIL_ICON[label] && <Icon name={DETAIL_ICON[label]} size={iconSize.xs} color={colors.textMuted} style={styles.detailIcon} />}
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={styles.detailValue}>{value || '-'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
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
  detailValue: { ...type.smallMedium, color: colors.textPrimary, textTransform: 'capitalize' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sectionIcon: { marginRight: spacing.xs },
  sectionTitle: { ...type.h3, color: colors.textPrimary },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  cancelButton: { marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  ratingChip: { flex: 1, marginVertical: 0 },
});

export default BookingDetailScreen;
