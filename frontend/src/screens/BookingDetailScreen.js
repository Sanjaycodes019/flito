import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSelector } from 'react-redux';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import Spinner from '../components/common/Spinner';
import DeliveryProofSection from '../components/bookings/DeliveryProofSection';
import { FLITO_COLORS } from '../utils/colors';
import { ROLES } from '../utils/constants';
import { formatCurrency, formatDate, formatStatus, getErrorMessage } from '../utils/helpers';
import api from '../services/api';
import { notify } from '../utils/alert';

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
  if (!booking) return <Text style={styles.empty}>Booking not found</Text>;

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
        {booking.currentLocation?.lat ? (
          <Detail label="Last Known Location" value={`${booking.currentLocation.lat.toFixed(4)}, ${booking.currentLocation.lng.toFixed(4)}`} />
        ) : null}
      </Card>

      {isOwner && !booking.driverId && booking.status !== 'cancelled' && (
        <Card>
          <Text style={styles.sectionTitle}>Assign a Driver</Text>
          <TextInput
            style={styles.input}
            value={driverPhone}
            onChangeText={setDriverPhone}
            placeholder="+9779841234567"
            keyboardType="phone-pad"
          />
          <Button title="Find & Assign" onPress={handleAssignDriver} loading={busy} />
        </Card>
      )}

      {isDriver && booking.status !== 'completed' && booking.status !== 'cancelled' && (
        <Card>
          <Text style={styles.sectionTitle}>Update Job Status</Text>
          {booking.pickupStatus !== 'picked_up' && (
            <View style={styles.actionsRow}>
              <Button title="Arrived at Pickup" variant="outline" onPress={() => handlePickupStatus('arrived')} loading={busy} style={styles.actionButton} />
              <Button title="Picked Up" onPress={() => handlePickupStatus('picked_up')} loading={busy} style={styles.actionButton} />
            </View>
          )}
          {booking.pickupStatus === 'picked_up' && booking.dropoffStatus !== 'delivered' && (
            <View style={styles.actionsRow}>
              <Button title="Arrived at Dropoff" variant="outline" onPress={() => handleDropoffStatus('arrived')} loading={busy} style={styles.actionButton} />
              <Button title="Delivered" onPress={() => handleDropoffStatus('delivered')} loading={busy} style={styles.actionButton} />
            </View>
          )}
        </Card>
      )}

      <DeliveryProofSection booking={booking} canUpload={canAddProof} onChanged={fetchBooking} />

      {isShipper && ['pending', 'confirmed'].includes(booking.status) && (
        <Button title="Cancel Booking" variant="outline" onPress={handleCancel} loading={busy} style={styles.cancelButton} />
      )}

      {booking.status === 'completed' && !alreadyRated && (
        <Card>
          <Text style={styles.sectionTitle}>Rate {isShipper ? 'the Owner' : 'the Shipper'}</Text>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                title={String(n)}
                variant={rating === String(n) ? 'primary' : 'outline'}
                onPress={() => setRating(String(n))}
                style={styles.ratingChip}
              />
            ))}
          </View>
          <TextInput style={styles.input} value={review} onChangeText={setReview} placeholder="Optional review" />
          <Button title="Submit Rating" onPress={handleRate} loading={busy} />
        </Card>
      )}
    </ScrollView>
  );
};

const Detail = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FLITO_COLORS.background },
  content: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: FLITO_COLORS.secondary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  detailLabel: { fontSize: 13, color: FLITO_COLORS.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: FLITO_COLORS.secondary, textTransform: 'capitalize' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: FLITO_COLORS.secondary, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1 },
  cancelButton: { marginTop: 8 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  ratingChip: { flex: 1, marginVertical: 0 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  empty: { textAlign: 'center', color: FLITO_COLORS.textMuted, marginTop: 40, fontSize: 14 },
});

export default BookingDetailScreen;
